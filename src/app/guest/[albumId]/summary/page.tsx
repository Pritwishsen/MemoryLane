import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/authOptions";
import { getAlbum, listPages } from "@/lib/albums";
import { markInviteOpened } from "@/lib/invites";
import SignInScreen from "@/components/SignInScreen";
import MapLoader from "@/components/MapLoader";
import AccountBadge from "@/components/AccountBadge";
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
      slug: p.nfcSlug,
    }));

  return (
    <main className="flex-1 px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-ink text-2xl font-semibold">{album.title}</h1>
            <p className="text-ink-soft mt-1 text-sm">
              {album.introText || "Here’s everywhere we went — tap a souvenir to relive it"}
            </p>
          </div>
          <AccountBadge
            name={session.user?.name ?? null}
            image={session.user?.image ?? null}
            email={session.user?.email ?? null}
          />
        </div>

        {pinned.length > 0 && (
          <div className="mt-6">
            <MapLoader pins={pinned} />
          </div>
        )}

        <p className="font-meta-label text-ink-soft mt-8 text-xs">
          Or browse pages directly:
        </p>
        {ordered.length === 0 ? (
          <p className="text-ink-soft mt-3 text-sm">This album doesn&rsquo;t have any pages yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {ordered.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.nfcSlug}`} className="text-ink hover:text-teal text-sm">
                  {p.header}
                  {p.place ? ` — ${p.place}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
