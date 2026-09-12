import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/authOptions";
import { getAlbum, listPages } from "@/lib/albums";
import { markInviteOpened } from "@/lib/invites";
import SignInScreen from "@/components/SignInScreen";
import AccountBadge from "@/components/AccountBadge";
import AlbumSummaryClient from "@/components/AlbumSummaryClient";
import type { Page } from "@/types/models";

type PageProps = {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<{ invite?: string }>;
};

export default async function GuestSummaryPage({ params, searchParams }: PageProps) {
  const { albumId } = await params;
  const { invite: inviteId } = await searchParams;
  const session = await getServerSession(authOptions);

  if (!session) {
    const callbackUrl = inviteId
      ? `/guest/${albumId}/summary?invite=${inviteId}`
      : `/guest/${albumId}/summary`;
    return <SignInScreen variant="guest" callbackUrl={callbackUrl} />;
  }

  const album = await getAlbum(albumId);
  if (!album) notFound();

  if (inviteId) {
    await markInviteOpened(inviteId);
  }

  const pages = await listPages(albumId);
  const ordered = album.pageOrder
    .map((id) => pages.find((p) => p.id === id))
    .filter((p): p is Page => Boolean(p))
    // A page with no slug yet has never been saved by the host — it's an
    // empty "Untitled" placeholder with nothing to show a guest, and
    // /p/{slug} would be a broken link without one.
    .filter((p) => p.nfcSlug);

  const pinned = ordered
    .filter((p) => p.lat !== null && p.lng !== null)
    .map((p) => ({
      id: p.id,
      lat: p.lat as number,
      lng: p.lng as number,
      label: p.place || p.header,
      header: p.header,
      country: p.country,
      slug: p.nfcSlug,
      albumTitle: album.title,
    }));

  const rows = ordered.map((p) => ({
    id: p.id,
    header: p.header,
    label: p.place || p.header,
    slug: p.nfcSlug,
  }));

  return (
    <main className="flex-1 px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="flex items-center justify-between">
          <Link href="/guest" className="font-meta-label text-ink-soft hover:text-ink text-[9.5px]">
            ← Your albums
          </Link>
          <AccountBadge
            name={session.user?.name ?? null}
            image={session.user?.image ?? null}
            email={session.user?.email ?? null}
          />
        </div>

        <div className="mt-5">
          <h1 className="font-display text-ink text-[26px] font-semibold">{album.title}</h1>
          <p className="text-ink-soft mt-1 text-[13px]">
            {album.introText || "Here’s everywhere we went — tap a souvenir to relive it"}
          </p>
        </div>

        <AlbumSummaryClient pins={pinned} rows={rows} />
      </div>
    </main>
  );
}
