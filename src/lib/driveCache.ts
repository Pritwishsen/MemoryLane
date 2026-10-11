// Short-lived per-process cache for host-side Drive reads (folder indexes,
// folder sharing lists), so reopening an album editor doesn't redo dozens of
// Drive calls. Keyed by the signed-in user so one account never sees
// another's view of Drive. Best effort: a cold process just recomputes.

type Entry = { at: number; value: unknown };
const store = new Map<string, Entry>();

export const FOLDER_INDEX_TTL_MS = 5 * 60_000;
export const PERMISSIONS_TTL_MS = 60_000;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  store.set(key, { at: Date.now(), value });
  if (store.size > 2000) {
    // Drop the oldest entries; Maps iterate in insertion order.
    for (const k of [...store.keys()].slice(0, 500)) store.delete(k);
  }
  return value;
}

/** Forget cached sharing lists after the app changes sharing (invite/remove). */
export function invalidatePermissions(uid: string, folderIds: string[]): void {
  for (const id of folderIds) store.delete(`perm:${uid}:${id}`);
}

export const folderIndexKey = (uid: string, folderId: string) => `idx:${uid}:${folderId}`;
export const permissionsKey = (uid: string, folderId: string) => `perm:${uid}:${folderId}`;
