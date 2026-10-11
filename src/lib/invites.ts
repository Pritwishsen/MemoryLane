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

/** Marks every invite this account has for the album as viewed. Called on
 *  any signed-in visit (summary or a tag page), whether the guest came in
 *  through the invite link or an NFC tag. Two equality filters need no
 *  composite index. No-op for accounts that weren't invited (e.g. owner). */
export async function recordGuestView(albumId: string, email: string): Promise<void> {
  const snap = await invitesCol()
    .where("albumId", "==", albumId)
    .where("guestEmail", "==", email.toLowerCase())
    .get();
  if (snap.empty) return;
  const now = new Date().toISOString();
  const batch = getAdminDb().batch();
  snap.docs.forEach((d) => batch.update(d.ref, { status: "opened", lastViewedAt: now }));
  await batch.commit();
}

/** All invite docs for one guest on one album (re-invites can leave more
 *  than one). */
export async function listInvitesForGuestOnAlbum(albumId: string, email: string): Promise<Invite[]> {
  const snap = await invitesCol()
    .where("albumId", "==", albumId)
    .where("guestEmail", "==", email.toLowerCase())
    .get();
  return snap.docs.map((d) => d.data() as Invite);
}

export async function deleteInvites(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = getAdminDb().batch();
  ids.forEach((id) => batch.delete(invitesCol().doc(id)));
  await batch.commit();
}

export async function listInvitesForAlbum(albumId: string): Promise<Invite[]> {
  const snap = await invitesCol().where("albumId", "==", albumId).get();
  return snap.docs.map((d) => d.data() as Invite);
}

/** Lets a signed-in guest discover which albums they've been invited to,
 *  without needing to still have the original email/link — a plain
 *  single-field equality query, no composite index needed. */
export async function listInvitesForGuest(email: string): Promise<Invite[]> {
  const snap = await invitesCol().where("guestEmail", "==", email.toLowerCase()).get();
  return snap.docs.map((d) => d.data() as Invite);
}

/** Host side: every invite for a set of albums, grouped by album id.
 *  Firestore's `in` filter takes at most 30 values, so ids are chunked. */
export async function listInvitesForAlbums(albumIds: string[]): Promise<Map<string, Invite[]>> {
  const byAlbum = new Map<string, Invite[]>(albumIds.map((id) => [id, []]));
  for (let i = 0; i < albumIds.length; i += 30) {
    const chunk = albumIds.slice(i, i + 30);
    const snap = await invitesCol().where("albumId", "in", chunk).get();
    for (const d of snap.docs) {
      const invite = d.data() as Invite;
      byAlbum.get(invite.albumId)?.push(invite);
    }
  }
  return byAlbum;
}

/** One entry per guest email, keeping the most recent invite — re-inviting
 *  the same person used to create a second doc. */
export function dedupeInvitesByEmail(invites: Invite[]): Invite[] {
  const latest = new Map<string, Invite>();
  for (const inv of invites) {
    const prev = latest.get(inv.guestEmail);
    if (!prev || inv.invitedAt > prev.invitedAt) latest.set(inv.guestEmail, inv);
  }
  return [...latest.values()].sort((a, b) => a.invitedAt.localeCompare(b.invitedAt));
}

/** Creates or refreshes the single invite for (album, email). Re-inviting
 *  keeps the existing doc id (so earlier invite links still work), merges
 *  app-created Drive permissions, keeps viewed state, and folds any older
 *  duplicate docs into it. */
export async function saveInvite(input: {
  id: string;
  albumId: string;
  guestEmail: string;
  note: string;
  sharedPermissions: Record<string, string>;
}): Promise<Invite> {
  const email = input.guestEmail.toLowerCase();
  const existing = await listInvitesForGuestOnAlbum(input.albumId, email);
  const keep = existing.find((i) => i.id === input.id);
  const mergedPerms = Object.assign({}, ...existing.map((i) => i.sharedPermissions ?? {}), input.sharedPermissions);
  const lastViewedAt = existing.map((i) => i.lastViewedAt).filter(Boolean).sort().pop();

  const invite: Invite = {
    id: input.id,
    albumId: input.albumId,
    guestEmail: email,
    note: input.note,
    invitedAt: new Date().toISOString(),
    status: existing.some((i) => i.status === "opened") ? "opened" : "sent",
    sharedPermissions: mergedPerms,
    ...(lastViewedAt ? { lastViewedAt } : {}),
  };

  const batch = getAdminDb().batch();
  batch.set(invitesCol().doc(input.id), invite);
  existing.filter((i) => i !== keep).forEach((i) => batch.delete(invitesCol().doc(i.id)));
  await batch.commit();
  return invite;
}
