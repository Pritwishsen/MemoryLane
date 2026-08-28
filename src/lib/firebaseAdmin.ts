import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let db: Firestore | undefined;

/**
 * Server-only Firestore access via the Admin SDK — the browser never talks
 * to Firestore directly (see firestore.rules, which denies all client
 * access), so every read/write goes through a Next.js API route that checks
 * the NextAuth session first. Lazily initialized + cached so repeated calls
 * across route handlers in the same process reuse one app instance.
 */
export function getAdminDb(): Firestore {
  if (db) return db;

  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !privateKey
    ) {
      throw new Error(
        "Missing Firebase Admin credentials — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env.local"
      );
    }
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);
  return db;
}
