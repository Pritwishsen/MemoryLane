import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/authOptions";
import { getAlbum, listPages } from "@/lib/albums";
import { listInvitesForGuest } from "@/lib/invites";
import { countryToIso2 } from "@/lib/countries";
import SignInScreen from "@/components/SignInScreen";
import AccountBadge from "@/components/AccountBadge";
import MapLoader from "@/components/MapLoader";
import { groupByCountry, groupByPlace, type MapPin } from "@/lib/mapGrouping";
import type { Album, Page } from "@/types/models";

export default async function GuestPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <SignInScreen variant="guest" />;
  }

  const invitedAlbums = await getInvitedAlbums(session.user?.email ?? null);
  const albumRows = await getAlbumRows(invitedAlbums);
  const pins = albumRows.flatMap((row) => row.pins);

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

  const totalCountries = groupByCountry(pins).length;
  const totalPlaces = groupByPlace(pins).length;

  return (
    <main className="flex-1 px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="flex items-center justify-between">
          <span className="font-meta-label text-ink-soft text-[10px] tracking-[0.14em]">
            MemoryLane
          </span>
          <AccountBadge
            name={session.user?.name ?? null}
            image={session.user?.image ?? null}
            email={session.user?.email ?? null}
          />
        </div>

        <h1 className="font-display text-ink mt-4 text-[27px] font-semibold">
          Your albums
        </h1>
        <p className="text-ink-soft mt-1 text-[13px]">
          Albums you&rsquo;ve been invited to
        </p>

        {pins.length > 0 && (
          <div className="relative mt-5">
            <MapLoader pins={pins} heightClassName="h-[212px]" initialZoomOffset={1} />
            <div
              className="absolute bottom-3 left-3 z-[1000] rounded-full px-[11px] py-[5px]"
              style={{
                background: "rgba(243,237,228,.94)",
                border: "1px solid rgba(34,32,27,.14)",
              }}
            >
              <span className="font-meta-label text-ink-soft text-[9.5px]">
                {totalCountries} {totalCountries === 1 ? "COUNTRY" : "COUNTRIES"} · {totalPlaces}{" "}
                {totalPlaces === 1 ? "PLACE" : "PLACES"}
              </span>
            </div>
          </div>
        )}

        <ul className="mt-6 flex flex-col gap-[10px]">
          {albumRows.map(({ album, pageCount, countries }) => (
            <li key={album.id}>
              <Link
                href={`/guest/${album.id}/summary`}
                className="flex items-center gap-3 rounded-[10px] border bg-white px-[14px] py-[13px] transition"
                style={{
                  borderColor: "rgba(34,32,27,.12)",
                  boxShadow: "0 1px 2px rgba(34,32,27,.06)",
                }}
              >
                <AlbumFlagCluster countries={countries} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-ink text-[15px] font-semibold">
                    {album.title}
                  </p>
                  <p className="font-meta-label text-ink-soft mt-0.5 truncate text-[9px]">
                    {pageCount} {pageCount === 1 ? "PAGE" : "PAGES"}
                    {countries.length > 0 ? ` · ${countries.join(", ")}` : ""}
                    {albumMonth(album.createdAt) ? ` · ${albumMonth(album.createdAt)}` : ""}
                  </p>
                </div>
                <span
                  className="shrink-0 text-[15px]"
                  style={{ color: "var(--color-brass)", fontFamily: "var(--font-body)" }}
                >
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

/** One or two decorative stamps for an album row — the flag language from
 *  the map pins reused at list scale (design_handoff_flag_map_pins v2,
 *  GUEST_SCREENS.md option 3a). Three or more countries still shows two:
 *  this is decoration, not a count (the meta line below already lists every
 *  country by name). */
function AlbumFlagCluster({ countries }: { countries: string[] }) {
  if (countries.length === 0) {
    return (
      <div className="album-flag-cluster">
        <div className="album-flag-stamp is-front">
          <span className="country-stamp-fallback" />
        </div>
      </div>
    );
  }

  const [front, behind] = countries;
  return (
    <div className="album-flag-cluster">
      {behind && (
        <div className="album-flag-stamp is-behind">
          <FlagOrFallback country={behind} />
        </div>
      )}
      <div className="album-flag-stamp is-front">
        <FlagOrFallback country={front} />
      </div>
    </div>
  );
}

function FlagOrFallback({ country }: { country: string }) {
  const iso2 = countryToIso2(country);
  return iso2 ? (
    <span className={`fi fi-${iso2.toLowerCase()}`} />
  ) : (
    <span className="country-stamp-fallback" />
  );
}

function albumMonth(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
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

/** Per-album pins (for the pooled map) plus the row-display data (page
 *  count, distinct countries, month) — one `listPages` call per album
 *  serves both, rather than fetching pages twice. Each pin still routes to
 *  /p/{slug} on click, which re-checks that specific page's Drive access on
 *  its own, so pooling pins here doesn't change what a guest can actually
 *  see, only what the map/rows show at a glance. Firestore page ids are
 *  globally unique, so ids can't collide across albums. */
async function getAlbumRows(
  albums: Album[],
): Promise<{ album: Album; pageCount: number; countries: string[]; pins: MapPin[] }[]> {
  return Promise.all(
    albums.map(async (album) => {
      const pages = await listPages(album.id);

      const seen = new Set<string>();
      const countries: string[] = [];
      for (const p of pages) {
        const country = p.country.trim();
        if (!country) continue;
        const key = country.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        countries.push(country);
      }

      const pins: MapPin[] = pages
        .filter((p): p is Page => p.lat !== null && p.lng !== null && Boolean(p.nfcSlug))
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

      return { album, pageCount: album.pageOrder.length, countries, pins };
    }),
  );
}
