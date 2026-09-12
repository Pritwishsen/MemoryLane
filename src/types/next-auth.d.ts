import "next-auth";
import "next-auth/jwt";

/**
 * We need the Google access token on the session for two reasons the spec
 * calls for explicitly:
 *  - Feature 6 (access control): the guest-facing page view calls Drive's
 *    files.list using the SIGNED-IN GUEST'S OWN token, not the host's.
 *  - Feature 5 (page editor): the host also needs their own token to browse
 *    their Drive folders while building a page.
 * uid is the Firestore users/{uid} doc id (same as the Google account's
 * stable `sub` claim), used to scope every album/page query to its owner.
 */
declare module "next-auth" {
  interface Session {
    uid: string;
    accessToken?: string;
    error?: "RefreshAccessTokenError" | "InsufficientScopeError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: "RefreshAccessTokenError" | "InsufficientScopeError";
  }
}
