import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/authOptions";
import { getAlbum, listPages } from "@/lib/albums";
import { listInvitesForGuest } from "@/lib/invites";
import SignInScreen from "@/components/SignInScreen";
import AccountBadge from "@/components/AccountBadge";
import MapLoader from "@/components/MapLoader";
import type { Album, Page } from "@/types/models";

export default async function GuestPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <SignInScreen variant="guest" />;
  }

  const invitedAlbums = await getInvitedAlbums(session.user?.email ?? null);
  const pins = await getAggregatedPins(invitedAlbums);

  if (invitedAlbums.length === 0) {
    return (
      <main className="flex min-h-full flex-1 flex-col items-center justify-center px-5 py-8 text-center sm:px-8">
        <div className="w-full max-w-[480px]">
          <div className="flex justify-center">
            <AccountBadge
              name={session.user?.name ?? null}
              image={session.user?.image ?? null}
              email={session.user?.email ?? null}
            />
          </div>
          <h1 className="font-display text-ink mt-4 text-2xl font-semibold">
            You&rsquo;re signed in
            {session.user?.name ? ` as ${session.user.name}` : ""}
          </h1>
          <p className="text-ink-soft mt-3 text-sm leading-relaxed">
            Tap an NFC tag or open the invite link your host sent you to see
            an album.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-ink text-2xl font-semibold">
            Your albums
          </h1>
          <AccountBadge
            name={session.user?.name ?? null}
            image={session.user?.image ?? null}
            email={session.user?.email ?? null}
          />
        </div>
        <p className="text-ink-soft mt-1 text-sm">
          Albums you&rsquo;ve been invited to
        </p>

        {pins.length > 0 && (
          <div className="mt-6">
            <MapLoader pins={pins} />
          </div>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {invitedAlbums.map((album) => (
            <li key={album.id}>
              <Link
                href={`/guest/${album.id}/summary`}
                className="border-ink/10 rounded-card block border bg-white px-4 py-3 transition hover:shadow-sm"
              >
                <span className="text-ink font-medium">{album.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

/** Distinct albums the signed-in guest has been invited to, most recently
 *  invited first. Skips any invite whose album has since been deleted. */
async function getInvitedAlbums(email: string | null): Promise<Album[]> {
  if (!email) return [];

  const invites = await listInvitesForGuest(email);
  const latestByAlbum = new Map<string, string>();
  for (const invite of invites) {
    const existing = latestByAlbum.get(invite.albumId);
    if (!existing || invite.invitedAt > existing) {
      latestByAlbum.set(invite.albumId, invite.invitedAt);
    }
  }

  const albumIds = [...latestByAlbum.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([albumId]) => albumId);

  const albums = await Promise.all(albumIds.map((id) => getAlbum(id)));
  return albums.filter((a): a is Album => a !== null);
}

/** One combined pin set across every album the guest has access to — same
 *  shape a single album's summary map uses, just pooled from all of them.
 *  Each pin still routes to /p/{slug} on click, which re-checks that
 *  specific page's Drive access on its own, so pooling pins here doesn't
 *  change what a guest can actually see, only what the map shows at a
 *  glance. Firestore page ids are globally unique, so ids can't collide
 *  across albums. */
async function getAggregatedPins(albums: Album[]) {
  const pagesByAlbum = await Promise.all(albums.map((a) => listPages(a.id)));

  return pagesByAlbum
    .flat()
    .filter((p): p is Page => p.lat !== null && p.lng !== null && Boolean(p.nfcSlug))
    .map((p) => ({
      id: p.id,
      lat: p.lat as number,
      lng: p.lng as number,
      label: p.place || p.header,
      header: p.header,
      country: p.country,
      slug: p.nfcSlug,
    }));
}
