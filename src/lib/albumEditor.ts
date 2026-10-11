import { driveImageUrl, listFolderPermissions, listImagesByFolder, permissionsGrantEmail } from "./drive";
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

function pageStats(page: Page, byFolder: Map<string, { id: string; thumbnailLink?: string; description?: string }[]>): PageStats {
  const seen = new Set<string>();
  let files = page.driveFolderIds.flatMap((id) => byFolder.get(id) ?? []).filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  if (page.imageFilter === "tagged" && page.tagKeyword.trim()) {
    const kw = page.tagKeyword.trim().toLowerCase();
    files = files.filter((f) => f.description?.toLowerCase().includes(kw));
  }
  const thumb = files.find((f) => f.thumbnailLink)?.thumbnailLink;
  return { photoCount: files.length, thumbUrl: thumb ? driveImageUrl(thumb, 160) : null };
}

function baseStatus(invites: Invite[]): { status: GuestStatus; lastViewedAt: string | null } {
  const lastViewedAt =
    invites
      .map((i) => i.lastViewedAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop() ?? null;
  const opened = lastViewedAt !== null || invites.some((i) => i.status === "opened");
  return { status: opened ? "viewed" : "invited", lastViewedAt };
}

/** Per-page photo stats and per-guest status for the album editor. All
 *  Drive calls use the host's token and fail soft: no token or a Drive
 *  error just means unknown counts and no "Needs Drive access" flags. */
export async function buildAlbumEditorData(
  albumId: string,
  pages: Page[],
  accessToken: string | undefined
): Promise<{ stats: Record<string, PageStats>; guests: GuestRow[]; accessChecked: boolean }> {
  const folderIds = [...new Set(pages.flatMap((p) => p.driveFolderIds))];
  const allInvites = await listInvitesForAlbum(albumId);
  const guestInvites = dedupeInvitesByEmail(allInvites);

  const [byFolder, permsByFolder] = await Promise.all([
    accessToken && folderIds.length > 0
      ? listImagesByFolder(accessToken, folderIds).catch(() => null)
      : Promise.resolve(null),
    accessToken && guestInvites.length > 0
      ? Promise.all(
          folderIds.map(async (id) => [id, await listFolderPermissions(accessToken, id).catch(() => null)] as const)
        )
      : Promise.resolve([] as (readonly [string, null])[]),
  ]);

  const stats: Record<string, PageStats> = {};
  for (const page of pages) {
    stats[page.id] = byFolder ? pageStats(page, byFolder) : { photoCount: null, thumbUrl: null };
  }

  const guests: GuestRow[] = guestInvites.map((latest) => {
    const invites = allInvites.filter((i) => i.guestEmail === latest.guestEmail);
    const { status, lastViewedAt } = baseStatus(invites);
    const missingFolderIds = permsByFolder
      .filter(([, perms]) => perms !== null && !permissionsGrantEmail(perms, latest.guestEmail))
      .map(([id]) => id);
    return {
      email: latest.guestEmail,
      status: missingFolderIds.length > 0 ? "needs-access" : status,
      invitedAt: latest.invitedAt,
      lastViewedAt,
      missingFolderIds,
    };
  });

  // Only claim "everyone can see the photos" if sharing was actually read.
  const accessChecked = permsByFolder.some(([, perms]) => perms !== null);
  return { stats, guests, accessChecked };
}
