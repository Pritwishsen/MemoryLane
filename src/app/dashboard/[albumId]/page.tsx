import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getOwnedAlbum, listPages } from "@/lib/albums";
import AlbumEditorClient from "@/components/AlbumEditorClient";

type PageProps = { params: Promise<{ albumId: string }> };

export default async function AlbumEditorPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/create");

  const { albumId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) notFound();

  const pages = await listPages(albumId);
  // pageOrder is the source of truth for display order; include any page
  // that's somehow missing from it (shouldn't happen, but don't silently
  // drop data if it does) at the end.
  const byId = new Map(pages.map((p) => [p.id, p]));
  const ordered = [
    ...album.pageOrder.map((id) => byId.get(id)).filter((p) => p != null),
    ...pages.filter((p) => !album.pageOrder.includes(p.id)),
  ];

  return <AlbumEditorClient album={album} initialPages={ordered} />;
}
