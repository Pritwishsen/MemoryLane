import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getOwnedAlbum } from "@/lib/albums";
import { checkDriveFoldersAccess } from "@/lib/drive";

type RouteContext = { params: Promise<{ albumId: string; pageId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const folderIds = req.nextUrl.searchParams.get("folderIds")?.split(",").filter(Boolean) ?? [];
  if (folderIds.length === 0) {
    return NextResponse.json({ results: [] });
  }
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Your Google session needs refreshing — sign in again" },
      { status: 400 }
    );
  }

  const results = await checkDriveFoldersAccess(session.accessToken, folderIds);
  return NextResponse.json({ results });
}
