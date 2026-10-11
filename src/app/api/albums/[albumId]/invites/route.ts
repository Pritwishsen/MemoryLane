import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/session";
import { getOwnedAlbum, listPages } from "@/lib/albums";
import { deleteInvites, listInvitesForGuestOnAlbum, newInviteId, saveInvite } from "@/lib/invites";
import { sendInviteEmail } from "@/lib/email";
import { revokePermissions, shareFolders, type ShareFailure } from "@/lib/sharing";
import { invalidatePermissions } from "@/lib/driveCache";

type RouteContext = { params: Promise<{ albumId: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite a guest. Order matters:
 *  1. Share the chosen Drive folders (so access exists before the email
 *     lands). Partial failures are reported per folder, not fatal.
 *  2. Send the invite email. If that fails, undo the shares made in step 1
 *     and write nothing: no half-invited guest with live Drive access.
 *  3. Save (or refresh) the invite doc, recording which permissions the app
 *     created so Remove can revoke exactly those.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const guestEmail = typeof body?.guestEmail === "string" ? body.guestEmail.trim().toLowerCase() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const requested: string[] = Array.isArray(body?.folderIds)
    ? body.folderIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  if (!EMAIL_RE.test(guestEmail)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (session.user?.email && guestEmail === session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "That's your own account — invite someone else" }, { status: 400 });
  }

  // Only folders actually attached to this album's pages can be shared.
  const albumFolders = new Set((await listPages(albumId)).flatMap((p) => p.driveFolderIds));
  const folderIds = [...new Set(requested)].filter((id) => albumFolders.has(id));

  let shared: Record<string, string> = {};
  let failed: ShareFailure[] = [];
  if (folderIds.length > 0) {
    if (!session.canShare || !session.accessToken || session.error) {
      return NextResponse.json(
        { error: "Reconnect Google Drive to share folders", code: "needs-share-scope" },
        { status: 403 }
      );
    }
    ({ shared, failed } = await shareFolders(session.accessToken, folderIds, guestEmail));
    invalidatePermissions(session.uid, folderIds);
  }

  const existing = await listInvitesForGuestOnAlbum(albumId, guestEmail);
  const latest = [...existing].sort((a, b) => a.invitedAt.localeCompare(b.invitedAt)).pop();
  const inviteId = latest?.id ?? newInviteId();
  const host = (await headers()).get("host") ?? "";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const summaryUrl = `${protocol}://${host}/guest/${albumId}/summary?invite=${inviteId}`;

  try {
    await sendInviteEmail({
      to: guestEmail,
      hostName: session.user?.name ?? "Your host",
      albumTitle: album.title,
      summaryUrl,
      note,
      foldersShared: Object.keys(shared).length > 0,
    });
  } catch (err) {
    if (session.accessToken && Object.keys(shared).length > 0) {
      await revokePermissions(session.accessToken, shared);
    }
    const message = err instanceof Error ? err.message : "Couldn't send the invite email";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const invite = await saveInvite({ id: inviteId, albumId, guestEmail, note, sharedPermissions: shared });
  return NextResponse.json({ invite, sharedCount: Object.keys(shared).length, failed });
}

/** Remove a guest: revoke the Drive shares this app made for them (shares
 *  the host added by hand in Drive are left alone), then delete their
 *  invite docs. */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const guestEmail = typeof body?.guestEmail === "string" ? body.guestEmail.trim().toLowerCase() : "";
  if (!guestEmail) {
    return NextResponse.json({ error: "guestEmail is required" }, { status: 400 });
  }

  const invites = await listInvitesForGuestOnAlbum(albumId, guestEmail);
  const perms = Object.assign({}, ...invites.map((i) => i.sharedPermissions ?? {})) as Record<string, string>;

  let unrevoked = 0;
  if (Object.keys(perms).length > 0) {
    if (!session.canShare || !session.accessToken || session.error) {
      return NextResponse.json(
        { error: "Reconnect Google Drive to remove this guest's folder access", code: "needs-share-scope" },
        { status: 403 }
      );
    }
    unrevoked = await revokePermissions(session.accessToken, perms);
    invalidatePermissions(session.uid, Object.keys(perms));
  }

  await deleteInvites(invites.map((i) => i.id));
  return NextResponse.json({ removed: invites.length, unrevoked });
}
