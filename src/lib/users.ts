import { getAdminDb } from "./firebaseAdmin";

export type AppUser = {
  uid: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
  createdAt: string;
};

export async function getUserById(uid: string): Promise<AppUser | null> {
  const doc = await getAdminDb().collection("users").doc(uid).get();
  return doc.exists ? (doc.data() as AppUser) : null;
}
