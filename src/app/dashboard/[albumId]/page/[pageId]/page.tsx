import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getOwnedAlbum, listPages } from "@/lib/albums";
import PageEditorClient from "@/components/PageEditorClient";

type PageProps = { params: Promise<{ albumId: string; pageId: string }> };

export default async function PageEditorPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/create");

  const { albumId, pageId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) notFound();

  const pages = await listPages(albumId);
  const page = pages.find((p) => p.id === pageId);
  if (!page) notFound();

  // Reading the Host header server-side (rather than window.location
  // client-side) means the NFC link's host renders identically on the
  // server and on hydration — no client-only branch, no mismatch.
  const host = (await headers()).get("host") ?? "";

  return (
    <PageEditorClient
      albumId={albumId}
      page={page}
      host={host}
      userName={session.user?.name ?? null}
      userImage={session.user?.image ?? null}
      userEmail={session.user?.email ?? null}
      sessionError={session.error}
    />
  );
}
