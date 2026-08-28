import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { addPage, getOwnedAlbum } from "@/lib/albums";

type RouteContext = { params: Promise<{ albumId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const header =
    typeof body?.header === "string" && body.header.trim()
      ? body.header.trim()
      : "Untitled";

  const page = await addPage(albumId, header);
  return NextResponse.json({ page }, { status: 201 });
}
