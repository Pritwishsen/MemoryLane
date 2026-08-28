import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { createAlbum, listAlbumsForUser } from "@/lib/albums";

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const albums = await listAlbumsForUser(session.uid);
  return NextResponse.json({ albums });
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const album = await createAlbum(session.uid, title);
  return NextResponse.json({ album }, { status: 201 });
}
