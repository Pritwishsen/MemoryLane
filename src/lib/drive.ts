import type { ImageFilter } from "@/types/models";

export type DriveImage = {
  id: string;
  name: string;
  thumbnailLink: string;
  description?: string;
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

  const data = await driveFetch(accessToken, "", {
    q,
    fields: "files(id,name,thumbnailLink,description)",
    pageSize: "1000",
  });

  let files: DriveImage[] = data.files ?? [];
  if (filter === "tagged" && tagKeyword.trim()) {
    const keyword = tagKeyword.trim().toLowerCase();
    files = files.filter((f) => f.description?.toLowerCase().includes(keyword));
  }
  return files;
}

/** Drive's thumbnailLink ends in "=s220" (or similar) — swapping that suffix
 *  for a larger size is the standard trick to get a full-size viewable image
 *  without a second API call or downloading+re-hosting the file ourselves. */
export function driveImageUrl(thumbnailLink: string, size = 1600): string {
  return thumbnailLink.replace(/=s\d+$/, `=s${size}`);
}
