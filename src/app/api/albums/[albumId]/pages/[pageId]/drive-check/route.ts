import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getOwnedAlbum } from "@/lib/albums";
import { checkDriveFoldersAccess, driveImageUrl, listImagesByFolder } from "@/lib/drive";

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

  const checks = await checkDriveFoldersAccess(session.accessToken, folderIds);

  // For reachable folders also return their images (compact), so the editor
  // can show counts, thumbnails, keyword-filtered totals and a live preview
  // without another round trip.
  const okIds = checks.filter((c) => c.ok).map((c) => c.folderId);
  const byFolder = okIds.length
    ? await listImagesByFolder(session.accessToken, okIds).catch(() => null)
    : null;

  const results = checks.map((c) => ({
    ...c,
    files: c.ok && byFolder
      ? (byFolder.get(c.folderId) ?? []).map((file) => ({
          id: file.id,
          name: file.name ?? "",
          thumb: file.thumbnailLink ? driveImageUrl(file.thumbnailLink, 320) : null,
          ...(file.description ? { desc: file.description } : {}),
        }))
      : undefined,
  }));
  return NextResponse.json({ results });
}
