// Google OAuth scopes. Everyone signs in with read-only Drive (guests only
// ever read). Hosts additionally grant full Drive so the Invite dialog can
// share and unshare folders (Drive has no narrower scope that can change
// sharing on folders the app didn't create). Plain module, client-safe.

export const DRIVE_READONLY = "https://www.googleapis.com/auth/drive.readonly";
export const DRIVE_FULL = "https://www.googleapis.com/auth/drive";

export const HOST_SCOPE = `openid email profile ${DRIVE_FULL}`;

/** Extra signIn() authorization params that upgrade to the host scope. */
export const HOST_AUTH_PARAMS = { scope: HOST_SCOPE, include_granted_scopes: "true" };
