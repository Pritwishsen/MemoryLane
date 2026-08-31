import { getAdminDb } from "./firebaseAdmin";
import type { Invite } from "@/types/models";

function invitesCol() {
  return getAdminDb().collection("invites");
}

/** Allocates an id without writing anything — the invite link has to be
 *  built into the email body before we know the send actually succeeds, and
 *  the Firestore doc should only be written once it has (see the route
 *  handler): a "sent" record for an email that never went out would be a
 *  silent lie to the host checking their invite list later. */
export function newInviteId(): string {
  return invitesCol().doc().id;
}

export async function createInvite(
  id: string,
  albumId: string,
  guestEmail: string,
  note: string
): Promise<Invite> {
  const invite: Invite = {
    id,
    albumId,
    // Lowercased so a guest's later sign-in email (Google normalizes these)
    // reliably matches what the host typed into the invite form — see
    // listInvitesForGuest, which is the whole reason this needs to line up.
    guestEmail: guestEmail.toLowerCase(),
    note,
    invitedAt: new Date().toISOString(),
    status: "sent",
  };
  await invitesCol().doc(id).set(invite);
  return invite;
}

export async function markInviteOpened(inviteId: string): Promise<void> {
  const ref = invitesCol().doc(inviteId);
  const doc = await ref.get();
  if (!doc.exists) return;
  // Never regress "opened" back to "sent" — this only ever moves forward.
  if ((doc.data() as Invite).status === "opened") return;
  await ref.update({ status: "opened" });
}

/** Lets a signed-in guest discover which albums they've been invited to,
 *  without needing to still have the original email/link — a plain
 *  single-field equality query, no composite index needed. */
export async function listInvitesForGuest(email: string): Promise<Invite[]> {
  const snap = await invitesCol().where("guestEmail", "==", email.toLowerCase()).get();
  return snap.docs.map((d) => d.data() as Invite);
}
