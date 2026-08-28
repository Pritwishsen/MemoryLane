import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { getAdminDb } from "./firebaseAdmin";

/**
 * Google's access tokens expire in ~1hr. Without refreshing, a guest who
 * signs in and comes back to a page later than that would suddenly fail the
 * Drive access check even though they're still genuinely shared on the
 * folder — refreshing keeps that check reliable for as long as the NextAuth
 * session itself lasts. `access_type=offline` + `prompt=consent` are both
 * required to reliably get a refresh_token back from Google (Google only
 * issues one on the very first consent otherwise).
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) throw new Error("No refresh token available");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      // Google only rotates the refresh token occasionally — keep the old one if absent.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (err) {
    console.error("Failed to refresh Google access token", err);
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/drive.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // First sign-in: `account`/`profile` are only present on this initial call.
      if (account && profile) {
        token.uid = (profile as { sub: string }).sub;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : undefined;

        // Feature 2: create the users/{uid} doc on first login (spec-required).
        const db = getAdminDb();
        const userRef = db.collection("users").doc(token.uid);
        const existing = await userRef.get();
        if (!existing.exists) {
          await userRef.set({
            uid: token.uid,
            email: profile.email ?? null,
            name: profile.name ?? null,
            photoUrl: (profile as { picture?: string }).picture ?? null,
            createdAt: new Date().toISOString(),
          });
        }

        return token;
      }

      // Subsequent calls: reuse the token until it's close to expiring.
      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 60_000
      ) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.uid = token.uid;
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
};
