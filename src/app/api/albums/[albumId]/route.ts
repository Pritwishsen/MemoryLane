import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { listInvitesForAlbum } from "@/lib/invites";
import { revokePermissions } from "@/lib/sharing";
import {
  deleteAlbum,
  getOwnedAlbum,
  listPages,
  renameAlbum,
  reorderPages,
  setAlbumIntroText,
} from "@/lib/albums";

type RouteContext = { params: Promise<{ albumId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pages = await listPages(albumId);
  return NextResponse.json({ album, pages });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    (body.pageOrder === undefined && body.title === undefined && body.introText === undefined)
  ) {
    return NextResponse.json(
      { error: "Provide pageOrder (array), title (string), and/or introText (string)" },
      { status: 400 }
    );
  }

  if (body.pageOrder !== undefined) {
    if (!Array.isArray(body.pageOrder)) {
      return NextResponse.json({ error: "pageOrder must be an array" }, { status: 400 });
    }
    await reorderPages(albumId, body.pageOrder);
  }

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    await renameAlbum(albumId, title);
  }

  if (body.introText !== undefined) {
    if (typeof body.introText !== "string") {
      return NextResponse.json({ error: "introText must be a string" }, { status: 400 });
    }
    // Empty is allowed on purpose — it means "fall back to the default text",
    // not a validation failure, unlike title above.
    await setAlbumIntroText(albumId, body.introText.trim());
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best effort: revoke Drive shares this app made for the album's guests
  // ("Guests lose access"). Never blocks the delete itself.
  if (session.canShare && session.accessToken && !session.error) {
    const invites = await listInvitesForAlbum(albumId);
    const perms = invites.map((i) => i.sharedPermissions ?? {});
    await Promise.all(perms.map((p) => revokePermissions(session.accessToken!, p))).catch(() => undefined);
  }

  await deleteAlbum(albumId);
  return NextResponse.json({ ok: true });
}
