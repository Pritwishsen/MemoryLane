import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getOwnedAlbum, listPages } from "@/lib/albums";
import { buildEditorDriveData } from "@/lib/albumEditor";

type RouteContext = { params: Promise<{ albumId: string }> };

/** Drive-derived album editor data (photo counts, thumbnails, guest Drive
 *  access), loaded by the editor after it has rendered from Firestore. */
export async function GET(_req: Request, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pages = await listPages(albumId);
  const token = session.error ? undefined : session.accessToken;
  return NextResponse.json(await buildEditorDriveData(session.uid, albumId, pages, token));
}
