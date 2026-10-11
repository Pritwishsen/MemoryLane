import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getOwnedAlbum, listPages } from "@/lib/albums";
import { buildGuestRowsQuick } from "@/lib/albumEditor";
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

  // Firestore only: the page renders at once and the editor fetches photo
  // counts, thumbnails and guest Drive access afterwards (editor-data API).
  const guests = await buildGuestRowsQuick(albumId);

  return (
    <AlbumEditorClient
      album={album}
      initialPages={ordered}
      initialGuests={guests}
      canShare={session.canShare && !session.error}
      userName={session.user?.name ?? null}
      userImage={session.user?.image ?? null}
      userEmail={session.user?.email ?? null}
    />
  );
}
