import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import {
  deleteAlbum,
  getOwnedAlbum,
  listPages,
  renameAlbum,
  reorderPages,
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
  if (!body || (body.pageOrder === undefined && body.title === undefined)) {
    return NextResponse.json(
      { error: "Provide pageOrder (array) and/or title (string)" },
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

  await deleteAlbum(albumId);
  return NextResponse.json({ ok: true });
}
