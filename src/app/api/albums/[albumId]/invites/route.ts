import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/session";
import { getOwnedAlbum } from "@/lib/albums";
import { createInvite, deleteInvites, listInvitesForGuestOnAlbum, newInviteId } from "@/lib/invites";
import { sendInviteEmail } from "@/lib/email";

type RouteContext = { params: Promise<{ albumId: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const guestEmail = typeof body?.guestEmail === "string" ? body.guestEmail.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (!EMAIL_RE.test(guestEmail)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const inviteId = newInviteId();
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't send the invite email";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const invite = await createInvite(inviteId, albumId, guestEmail, note);
  return NextResponse.json({ invite });
}

/** Remove a guest from the album: deletes every invite doc for that email. */
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
  await deleteInvites(invites.map((i) => i.id));
  return NextResponse.json({ removed: invites.length });
}
