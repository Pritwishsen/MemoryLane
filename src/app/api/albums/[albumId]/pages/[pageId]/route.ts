import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { deletePage, getOwnedAlbum } from "@/lib/albums";

type RouteContext = { params: Promise<{ albumId: string; pageId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId, pageId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deletePage(albumId, pageId);
  return NextResponse.json({ ok: true });
}
