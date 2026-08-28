import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";

/**
 * Every API route is the only thing allowed to talk to Firestore (see
 * firestore.rules), so this check IS the app's access control for host-side
 * data — skipping it on any route would let one signed-in user read/write
 * another's albums via the Admin SDK's unrestricted access.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.uid) {
    return {
      session: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  return { session, unauthorized: null } as const;
}
