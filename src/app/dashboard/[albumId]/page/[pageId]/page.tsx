import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/authOptions";
import { getOwnedAlbum, listPages } from "@/lib/albums";

type PageProps = { params: Promise<{ albumId: string; pageId: string }> };

// Phase 3 builds the real form (header, story, location, Drive folder,
// image filter, display mode). For now this just confirms the page exists
// and is owned by the signed-in host, so the editor's row links aren't dead.
export default async function PageEditorStub({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/create");

  const { albumId, pageId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) notFound();

  const pages = await listPages(albumId);
  const page = pages.find((p) => p.id === pageId);
  if (!page) notFound();

  return (
    <main className="flex-1 px-5 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-[720px]">
        <Link
          href={`/dashboard/${albumId}`}
          className="font-meta-label text-ink-soft hover:text-ink"
        >
          ← Back to album
        </Link>
        <h1 className="font-display text-ink mt-4 text-2xl font-semibold">
          {page.header}
        </h1>
        <p className="text-ink-soft mt-3 text-sm">
          The full page editor (story, location, Drive folder, display
          options) is coming in the next build phase.
        </p>
      </div>
    </main>
  );
}
