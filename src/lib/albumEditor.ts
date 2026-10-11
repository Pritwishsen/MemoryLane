import { indexFolder, listFolderPermissions, mapLimit, permissionsGrantEmail, type DrivePermission, type FolderIndex } from "./drive";
import { cached, folderIndexKey, FOLDER_INDEX_TTL_MS, permissionsKey, PERMISSIONS_TTL_MS } from "./driveCache";
import { dedupeInvitesByEmail, listInvitesForAlbum } from "./invites";
import type { GuestStatus } from "@/components/ui/styles";
import type { Invite, Page } from "@/types/models";

export type PageStats = {
  /** Photos a guest would get from this page's folders after the keyword
   *  filter (before any random limit). null = couldn't ask Drive. */
  photoCount: number | null;
  thumbUrl: string | null;
};

export type GuestRow = {
  email: string;
  status: GuestStatus;
  invitedAt: string;
  lastViewedAt: string | null;
  /** Connected folders this guest provably can't read. */
  missingFolderIds: string[];
};

export type EditorDriveData = {
  stats: Record<string, PageStats>;
  guests: GuestRow[];
  /** False when Drive sharing could not be read (no token, not owner). */
  accessChecked: boolean;
};

/** Drive calls in flight at once for one album. */
const DRIVE_CONCURRENCY = 8;

function pageStats(page: Page, byFolder: Map<string, FolderIndex | null>): PageStats {
  const indexes = page.driveFolderIds.map((id) => byFolder.get(id));
  if (indexes.length > 0 && indexes.every((ix) => !ix)) return { photoCount: null, thumbUrl: null };
  const seen = new Set<string>();
  let files = indexes.flatMap((ix) => ix?.files ?? []).filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  if (page.imageFilter === "tagged" && page.tagKeyword.trim()) {
    const kw = page.tagKeyword.trim().toLowerCase();
    files = files.filter((f) => f.desc?.toLowerCase().includes(kw));
  }
  return { photoCount: files.length, thumbUrl: indexes.find((ix) => ix?.thumb)?.thumb ?? null };
}

function guestRows(allInvites: Invite[], permsByFolder: [string, DrivePermission[] | null][]): GuestRow[] {
  return dedupeInvitesByEmail(allInvites).map((latest) => {
    const invites = allInvites.filter((i) => i.guestEmail === latest.guestEmail);
    const lastViewedAt =
      invites
        .map((i) => i.lastViewedAt)
        .filter((v): v is string => Boolean(v))
        .sort()
        .pop() ?? null;
    const opened = lastViewedAt !== null || invites.some((i) => i.status === "opened");
    const missingFolderIds = permsByFolder
      .filter(([, perms]) => perms !== null && !permissionsGrantEmail(perms, latest.guestEmail))
      .map(([id]) => id);
    return {
      email: latest.guestEmail,
      status: missingFolderIds.length > 0 ? "needs-access" : opened ? "viewed" : "invited",
      invitedAt: latest.invitedAt,
      lastViewedAt,
      missingFolderIds,
    };
  });
}

/** Firestore-only guest list (Viewed / Invited, no Drive check), so the
 *  album editor can render immediately. */
export async function buildGuestRowsQuick(albumId: string): Promise<GuestRow[]> {
  return guestRows(await listInvitesForAlbum(albumId), []);
}

/** Per-page photo stats and per-guest Drive status, fetched after the
 *  editor has rendered. Folders are indexed in parallel (ids only) and both
 *  indexes and sharing lists are cached briefly per user. Everything fails
 *  soft: a Drive error means unknown counts and no "Needs Drive access". */
export async function buildEditorDriveData(
  uid: string,
  albumId: string,
  pages: Page[],
  accessToken: string | undefined
): Promise<EditorDriveData> {
  const folderIds = [...new Set(pages.flatMap((p) => p.driveFolderIds))];
  const allInvites = await listInvitesForAlbum(albumId);
  const hasGuests = allInvites.length > 0;

  const [indexes, perms] = accessToken
    ? await Promise.all([
        mapLimit(folderIds, DRIVE_CONCURRENCY, (id) =>
          cached(folderIndexKey(uid, id), FOLDER_INDEX_TTL_MS, () => indexFolder(accessToken, id)).catch(() => null)
        ),
        hasGuests
          ? mapLimit(folderIds, DRIVE_CONCURRENCY, (id) =>
              cached(permissionsKey(uid, id), PERMISSIONS_TTL_MS, () => listFolderPermissions(accessToken, id)).catch(
                () => null
              )
            )
          : Promise.resolve([] as (DrivePermission[] | null)[]),
      ])
    : [folderIds.map(() => null), [] as (DrivePermission[] | null)[]];

  const byFolder = new Map(folderIds.map((id, i) => [id, indexes[i]]));
  const permsByFolder = perms.map((p, i) => [folderIds[i], p] as [string, DrivePermission[] | null]);

  const stats: Record<string, PageStats> = {};
  for (const page of pages) stats[page.id] = pageStats(page, byFolder);

  return {
    stats,
    guests: guestRows(allInvites, permsByFolder),
    // Only claim "everyone can see the photos" if sharing was actually read.
    accessChecked: permsByFolder.some(([, p]) => p !== null),
  };
}
