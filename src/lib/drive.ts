import type { ImageFilter } from "@/types/models";

export type DriveImage = {
  id: string;
  name: string;
  thumbnailLink: string;
  description?: string;
  /** Pixel size as Drive reports it (already swapped for 90°/270° EXIF
   *  rotation by listDriveImages), for layouts that need aspect ratios. */
  width?: number;
  height?: number;
};

const FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";

/**
 * Hosts paste a full Drive folder URL far more often than a bare ID — this
 * covers the URL shapes Drive actually produces ("/drive/folders/<id>",
 * "/drive/u/0/folders/<id>", "open?id=<id>") plus a raw ID typed directly.
 */
export function parseDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch) return foldersMatch[1];

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;

  return null;
}

/** Carries the HTTP status so callers can tell "Drive positively says you
 *  have no access to this file" (404 — Drive deliberately returns 404 rather
 *  than 403 for a file/folder you can't see, to avoid confirming it exists)
 *  apart from every other kind of failure (expired token, API not enabled,
 *  rate limit, network blip) — those are NOT evidence of a sharing problem
 *  and must never be presented to a guest as "ask the host to share this." */
export class DriveApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Google returns this as a 403 with this exact message when the access
 *  token doesn't carry the drive.readonly scope — happens when a host's
 *  sign-in predates the scope being granted (a refresh can never add a
 *  scope that wasn't in the original consent), or their account isn't yet
 *  on the OAuth consent screen's test-user list. Distinguishing it from
 *  other errors lets callers point the host at "sign out and back in"
 *  instead of showing Google's raw, cryptic message. */
function isInsufficientScopeError(err: unknown): boolean {
  return (
    err instanceof DriveApiError &&
    err.status === 403 &&
    /insufficient authentication scopes/i.test(err.message)
  );
}

async function driveFetch(accessToken: string, path: string, params: Record<string, string>) {
  const url = new URL(`${FILES_ENDPOINT}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message ?? `Drive API error (${res.status})`;
    throw new DriveApiError(message, res.status);
  }

  return res.json();
}

export async function checkDriveFolderAccess(
  accessToken: string,
  folderId: string
): Promise<
  | { ok: true; name: string }
  | { ok: false; error: string; reason: "not-shared" | "insufficient-scope" | "unknown" }
> {
  try {
    const data = await driveFetch(accessToken, `/${folderId}`, {
      fields: "id,name,mimeType",
    });
    if (data.mimeType !== "application/vnd.google-apps.folder") {
      return { ok: false, error: "That link isn't a folder", reason: "unknown" };
    }
    return { ok: true, name: data.name };
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 404) {
      return { ok: false, error: err.message, reason: "not-shared" };
    }
    if (isInsufficientScopeError(err)) {
      return {
        ok: false,
        error: "Your Google sign-in needs to be refreshed to grant Drive access.",
        reason: "insufficient-scope",
      };
    }
    const message = err instanceof Error ? err.message : "Couldn't access this folder yet";
    return { ok: false, error: message, reason: "unknown" };
  }
}

export type DriveFolderCheckResult =
  | { folderId: string; ok: true; name: string }
  | {
      folderId: string;
      ok: false;
      error: string;
      reason: "not-shared" | "insufficient-scope" | "unknown";
    };

export async function checkDriveFoldersAccess(
  accessToken: string,
  folderIds: string[]
): Promise<DriveFolderCheckResult[]> {
  return Promise.all(
    folderIds.map(async (folderId) => ({
      folderId,
      ...(await checkDriveFolderAccess(accessToken, folderId)),
    }))
  );
}

/**
 * A page can pull from several Drive folders at once — Drive's query
 * language lets a single files.list call OR together "X in parents" clauses,
 * so this is still one request no matter how many folders are configured
 * (a file that happens to live in more than one of them is deduped by Drive
 * itself since each file only appears once in the result).
 *
 * Drive folders also don't support custom tags, so the "tagged" filter (spec
 * Feature 5) matches a host-chosen keyword against each file's own
 * description field client-side — Drive's query language can't do substring
 * matching on description, so "tagged" always fetches the full list first
 * and filters in memory.
 */
export async function listDriveImages(
  accessToken: string,
  folderIds: string[],
  filter: ImageFilter,
  tagKeyword: string
): Promise<DriveImage[]> {
  if (folderIds.length === 0) return [];

  const parentClause = folderIds.map((id) => `'${id}' in parents`).join(" or ");
  const q = `(${parentClause}) and mimeType contains 'image/' and trashed = false`;

  // Follow nextPageToken: a single call silently stopped at 1000 files.
  type Raw = Omit<DriveImage, "width" | "height"> & {
    imageMediaMetadata?: { width?: number; height?: number; rotation?: number };
  };
  const raw: Raw[] = [];
  let pageToken: string | undefined;
  do {
    const data = await driveFetch(accessToken, "", {
      q,
      fields: "nextPageToken,files(id,name,thumbnailLink,description,imageMediaMetadata(width,height,rotation))",
      orderBy: "name",
      pageSize: "1000",
      ...(pageToken ? { pageToken } : {}),
    });
    raw.push(...((data.files ?? []) as Raw[]));
    pageToken = data.nextPageToken;
  } while (pageToken);

  let files: DriveImage[] = raw.map(({ imageMediaMetadata: m, ...rest }) => {
    const sideways = m?.rotation === 1 || m?.rotation === 3;
    return { ...rest, width: sideways ? m?.height : m?.width, height: sideways ? m?.width : m?.height };
  });
  if (filter === "tagged" && tagKeyword.trim()) {
    const keyword = tagKeyword.trim().toLowerCase();
    files = files.filter((f) => f.description?.toLowerCase().includes(keyword));
  }
  return files;
}

/** Thumbnail of the first image (by name) across the given folders, or null
 *  if they hold none. Used for album cover tiles; one cheap pageSize=1 call. */
export async function firstImageThumbnail(accessToken: string, folderIds: string[]): Promise<string | null> {
  if (folderIds.length === 0) return null;
  const parentClause = folderIds.map((id) => `'${id}' in parents`).join(" or ");
  const data = await driveFetch(accessToken, "", {
    q: `(${parentClause}) and mimeType contains 'image/' and trashed = false`,
    fields: "files(thumbnailLink)",
    orderBy: "name",
    pageSize: "1",
  });
  return data.files?.[0]?.thumbnailLink ?? null;
}

/** Drive's thumbnailLink ends in "=s220" (or similar) — swapping that suffix
 *  for a larger size is the standard trick to get a full-size viewable image
 *  without a second API call or downloading+re-hosting the file ourselves. */
export function driveImageUrl(thumbnailLink: string, size = 1600): string {
  return thumbnailLink.replace(/=s\d+$/, `=s${size}`);
}

export type FolderImageFile = { id: string; name?: string; parents?: string[]; thumbnailLink?: string; description?: string };

/** Every image across the given folders, attributed to each folder it sits
 *  in. Paginates and chunks the parents clause, so one call covers a whole
 *  album's folders without the 1000-file cap. */
export async function listImagesByFolder(
  accessToken: string,
  folderIds: string[]
): Promise<Map<string, FolderImageFile[]>> {
  const byFolder = new Map<string, FolderImageFile[]>(folderIds.map((id) => [id, []]));
  const unique = [...new Set(folderIds)];
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    const parentClause = chunk.map((id) => `'${id}' in parents`).join(" or ");
    let pageToken: string | undefined;
    do {
      const data = await driveFetch(accessToken, "", {
        q: `(${parentClause}) and mimeType contains 'image/' and trashed = false`,
        fields: "nextPageToken,files(id,name,parents,thumbnailLink,description)",
        orderBy: "name",
        pageSize: "1000",
        ...(pageToken ? { pageToken } : {}),
      });
      for (const f of (data.files ?? []) as FolderImageFile[]) {
        for (const parent of f.parents ?? []) byFolder.get(parent)?.push(f);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  return byFolder;
}

export type DrivePermission = { type: string; role: string; emailAddress?: string };

/** Who a file/folder is shared with. Needs the caller to be allowed to see
 *  sharing (owner or editor); viewers get a 403, which callers should treat
 *  as "unknown", not "not shared". */
export async function listFolderPermissions(accessToken: string, folderId: string): Promise<DrivePermission[]> {
  const data = await driveFetch(accessToken, `/${folderId}/permissions`, {
    fields: "permissions(type,role,emailAddress)",
    supportsAllDrives: "true",
    pageSize: "100",
  });
  return data.permissions ?? [];
}

/** Whether a permission list grants `email` at least read access. Group and
 *  domain shares can't be resolved to individual people, so they don't
 *  count; an "anyone with the link" share does. */
export function permissionsGrantEmail(perms: DrivePermission[], email: string): boolean {
  const target = email.toLowerCase();
  return perms.some(
    (p) => p.type === "anyone" || (p.type === "user" && p.emailAddress?.toLowerCase() === target)
  );
}

async function driveSend(
  accessToken: string,
  method: "POST" | "DELETE",
  path: string,
  params: Record<string, string>,
  body?: unknown
) {
  const url = new URL(`${FILES_ENDPOINT}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new DriveApiError(data?.error?.message ?? `Drive API error (${res.status})`, res.status);
  }
  return res.status === 204 ? null : res.json();
}

/** Shares a folder view-only with one person and returns the permission id.
 *  Google's own share email is suppressed; MemoryLane sends the invite.
 *  Requires the full Drive scope. */
export async function createReaderPermission(accessToken: string, folderId: string, email: string): Promise<string> {
  const data = await driveSend(
    accessToken,
    "POST",
    `/${folderId}/permissions`,
    { sendNotificationEmail: "false", supportsAllDrives: "true", fields: "id" },
    { type: "user", role: "reader", emailAddress: email }
  );
  return data.id as string;
}

/** Removes one permission. A 404 (already removed, e.g. by hand in Drive)
 *  counts as success. */
export async function deletePermission(accessToken: string, folderId: string, permissionId: string): Promise<void> {
  try {
    await driveSend(accessToken, "DELETE", `/${folderId}/permissions/${permissionId}`, { supportsAllDrives: "true" });
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 404) return;
    throw err;
  }
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveFolder = { id: string; name: string };

/** Sub-folders of a folder, or the top level of "My Drive" ("root") or
 *  "Shared with me" ("shared"), sorted by name. Capped at 500. */
export async function listChildFolders(accessToken: string, parent: string): Promise<DriveFolder[]> {
  const scope = parent === "shared" ? "sharedWithMe" : `'${parent}' in parents`;
  const folders: DriveFolder[] = [];
  let pageToken: string | undefined;
  do {
    const data = await driveFetch(accessToken, "", {
      q: `${scope} and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "nextPageToken,files(id,name)",
      orderBy: "name",
      pageSize: "200",
      ...(pageToken ? { pageToken } : {}),
    });
    folders.push(...((data.files ?? []) as DriveFolder[]));
    pageToken = data.nextPageToken;
  } while (pageToken && folders.length < 500);
  return folders;
}

/** Path from the top of the host's Drive down to `folderId` (inclusive).
 *  Folders shared by someone else stop at the first parent the host can't
 *  see, so their path starts at "Shared with me". */
export async function getFolderBreadcrumb(accessToken: string, folderId: string): Promise<DriveFolder[]> {
  const trail: DriveFolder[] = [];
  let id: string | undefined = folderId;
  for (let depth = 0; id && depth < 10; depth++) {
    let data: { id: string; name: string; parents?: string[] };
    try {
      data = await driveFetch(accessToken, `/${id}`, { fields: "id,name,parents" });
    } catch {
      break;
    }
    if (!data.parents?.length) {
      // Reached the top: the host's own root is "My Drive".
      trail.unshift({ id: "root", name: "My Drive" });
      return trail;
    }
    trail.unshift({ id: data.id, name: data.name });
    id = data.parents[0];
  }
  trail.unshift({ id: "shared", name: "Shared with me" });
  return trail;
}

export type FolderStats = { count: number; capped: boolean; thumb: string | null };

/** Photo count (capped at 1000, flagged) and first thumbnail per folder, one
 *  small query per folder with limited concurrency. Fast enough for a picker
 *  row; use listImagesByFolder when exact totals matter. */
export async function folderStats(accessToken: string, folderIds: string[]): Promise<Record<string, FolderStats | null>> {
  const out: Record<string, FolderStats | null> = {};
  const queue = [...new Set(folderIds)];
  async function worker() {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const data = await driveFetch(accessToken, "", {
          q: `'${id}' in parents and mimeType contains 'image/' and trashed = false`,
          fields: "nextPageToken,files(id,thumbnailLink)",
          orderBy: "name",
          pageSize: "1000",
        });
        const files: { id: string; thumbnailLink?: string }[] = data.files ?? [];
        const thumb = files.find((f) => f.thumbnailLink)?.thumbnailLink;
        out[id] = { count: files.length, capped: Boolean(data.nextPageToken), thumb: thumb ? driveImageUrl(thumb, 120) : null };
      } catch {
        out[id] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));
  return out;
}
