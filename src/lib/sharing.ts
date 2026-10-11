import { DriveApiError, createReaderPermission, deletePermission } from "./drive";

export type ShareFailure = { folderId: string; message: string };

/** Turns Drive's sharing errors into something a host can act on. */
function shareErrorMessage(err: unknown): string {
  if (!(err instanceof DriveApiError)) return "Couldn't reach Google Drive";
  if (/notification/i.test(err.message)) {
    return "This address isn't a Google account, so Drive can't share with it";
  }
  if (err.status === 403) return "You don't have permission to share this folder";
  if (err.status === 404) return "Folder not found in your Drive";
  return err.message;
}

/** Shares each folder view-only with `email`. Runs in parallel; returns the
 *  permission ids created plus a readable reason for each failure. */
export async function shareFolders(
  accessToken: string,
  folderIds: string[],
  email: string
): Promise<{ shared: Record<string, string>; failed: ShareFailure[] }> {
  const results = await Promise.all(
    [...new Set(folderIds)].map(async (folderId) => {
      try {
        const permissionId = await createReaderPermission(accessToken, folderId, email);
        return { ok: true as const, folderId, permissionId };
      } catch (err) {
        return { ok: false as const, folderId, message: shareErrorMessage(err) };
      }
    })
  );
  const shared: Record<string, string> = {};
  const failed: ShareFailure[] = [];
  for (const r of results) {
    if (r.ok) shared[r.folderId] = r.permissionId;
    else failed.push({ folderId: r.folderId, message: r.message });
  }
  return { shared, failed };
}

/** Best-effort revoke of permissions the app created. Returns how many
 *  could not be removed (the caller decides whether to surface that). */
export async function revokePermissions(accessToken: string, perms: Record<string, string>): Promise<number> {
  const results = await Promise.allSettled(
    Object.entries(perms).map(([folderId, permId]) => deletePermission(accessToken, folderId, permId))
  );
  return results.filter((r) => r.status === "rejected").length;
}
