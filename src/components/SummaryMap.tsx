"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "flag-icons/css/flag-icons.min.css";
import { countryToIso2 } from "@/lib/countries";
import { ringLabelLayout, isNonLatinText } from "@/lib/postmarkLabel";
import {
  groupByCountry,
  groupByPlace,
  tiltForKey,
  type MapPin,
  type CountryGroup,
  type PlaceGroup,
} from "@/lib/mapGrouping";

export type { MapPin };

type SummaryMapProps = {
  pins: MapPin[];
  /** Overrides the map's height/rounding utility classes — e.g. the guest
   *  landing page and album summary page each want a different fixed height
   *  than the default. Border/radius stay constant across callers. */
  heightClassName?: string;
  /** Design_handoff_flag_map_pins v2, GUEST_SCREENS.md's pin↔row highlight
   *  on the album summary screen: a place row hovered/selected OUTSIDE the
   *  map (in the page list) rings that place's postmark in brass too,
   *  independent of the map's own internal `selectedPlaceKey` (which drives
   *  the tap-to-open bottom sheet and shouldn't fire just from a hover). */
  highlightedPlaceKey?: string | null;
  /** Fires on postmark hover/unhover so an external page-row list can
   *  highlight in sync the other direction. */
  onPlaceHover?: (key: string | null) => void;
  /** Applied once, immediately after the map's initial fitBounds — e.g. 2
   *  to land two zoom levels further in than the bounds fit would naturally
   *  land on. The guest landing page wants a closer first view than the
   *  tight-but-zoomed-out bounds fit gives it; other callers leave this
   *  unset. Positive zooms IN, negative zooms OUT. */
  initialZoomOffset?: number;
};

/** Below this zoom the map shows one pin per country (flag + place count);
 *  at or above it, individual pages take over, distance-clustered. Chosen
 *  to roughly match "you can tell countries apart" vs. "you can tell cities
 *  apart" — reasonable for typical country sizes, not tuned per-country. */
const COUNTRY_ZOOM_THRESHOLD = 6;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Design: design_handoff_flag_map_pins/RING_LABEL.md (option 7b). The place
 *  name runs along the inside of the postmark ring on a curved SVG textPath,
 *  as on a real cancellation stamp, so it never truncates below the 8px
 *  legibility floor the way the old shrink-to-fit flat badge could. One
 *  badge, one state, at every zoom — no compact variant. Returns the inner
 *  HTML only (not wrapped in L.divIcon) so placePacketIcon() below can
 *  compose a full-detail front ring alongside plain faded ones behind it. */
// RING_LABEL.md specs a 74px badge; sized down 20% per review to 59px, then
// another 20% per a later review to 47px. The 8px ring text stays at its
// spec'd hard floor regardless (never scale below it) — only the
// surrounding geometry shrinks.
const RING_SIZE = 47;
const RING_CENTER = RING_SIZE / 2;
const RING_TEXT_RADIUS = 16;

function ringPostmarkHtml(place: PlaceGroup, opts: { selected?: boolean } = {}): string {
  const tilt = tiltForKey(place.key);
  const stateClass = opts.selected ? " is-selected" : "";
  // textPath's href resolves document-wide, so every marker needs its own
  // path id or they'd all render the first marker's name (RING_LABEL.md).
  const pathId = `ring-path-${place.key.replace(/[^a-z0-9]/gi, "") || "x"}`;

  if (isNonLatinText(place.label)) {
    // CJK/Devanagari/etc. set far wider per character and don't tolerate
    // letter-spacing — name goes in a bigger inner disc instead, ring blank.
    return `<div class="ring-postmark${stateClass}" style="--stamp-tilt:${tilt}deg;">
      <div class="ring-postmark-inner is-name">${escapeHtml(place.label.toUpperCase())}</div>
    </div>`;
  }

  const { text, letterSpacing } = ringLabelLayout(place.label);
  const pageCount = place.pages.length;
  // Path starts at the BOTTOM of the ring (not the left/west point) so that
  // startOffset 50% — the diametrically opposite point, the top — has the
  // full circumference split evenly on both sides. A textPath can't render
  // past either end of its path: starting the path at the west point with
  // startOffset 25% (the old version) only left 25% of the circumference
  // behind the text-anchor="middle" label's start, so anything longer than
  // that got its FRONT silently clipped — "Vatican City" rendered as
  // "tican City", "East Sussex" as "st Sussex". Centering the text on the
  // point farthest from the path's start/end gives it the most room
  // possible in both directions.
  const d = `M${RING_CENTER},${RING_CENTER + RING_TEXT_RADIUS} a${RING_TEXT_RADIUS},${RING_TEXT_RADIUS} 0 1,1 0,-${RING_TEXT_RADIUS * 2} a${RING_TEXT_RADIUS},${RING_TEXT_RADIUS} 0 1,1 0,${RING_TEXT_RADIUS * 2}`;
  return `<div class="ring-postmark${stateClass}" style="--stamp-tilt:${tilt}deg;">
    <svg class="ring-postmark-svg" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">
      <defs><path id="${pathId}" d="${d}" /></defs>
      <text class="ring-postmark-text" style="letter-spacing:${letterSpacing};">
        <textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapeHtml(text)}</textPath>
      </text>
    </svg>
    <div class="ring-postmark-inner">${pageCount > 1 ? pageCount : ""}</div>
  </div>`;
}

function postmarkIcon(place: PlaceGroup, opts: { selected?: boolean } = {}): L.DivIcon {
  return L.divIcon({
    className: "",
    html: ringPostmarkHtml(place, opts),
    iconSize: [RING_SIZE, RING_SIZE],
    iconAnchor: [RING_CENTER, RING_CENTER],
  });
}

/** Design: RING_LABEL.md's "Crowding" section — reuses the country tier's
 *  screen-space packet grouping (option 2b) at place tier, threshold raised
 *  to 80px since the ring badge is much bigger than the country stamp. The
 *  front ring gets full detail (curved text + count disc); the up-to-two
 *  rings fanned behind are plain and faded, matching the country packet's
 *  treatment of its behind layers. Offsets are the country packet's own
 *  (+8/+5, +14/+10) scaled by the ring's size over the country stamp, then
 *  rescaled again alongside RING_SIZE's own later 20% reduction. */
const PLACE_PACKET_BEHIND_OFFSETS = [
  { left: 10, top: 6 },
  { left: 18, top: 13 },
];

function placePacketIcon(members: PlaceGroup[]): L.DivIcon {
  const behindLayers = PLACE_PACKET_BEHIND_OFFSETS.map((offset, i) =>
    members[i + 1]
      ? `<div class="ring-postmark-behind is-packet-behind-${i + 1}" style="left:${offset.left}px;top:${offset.top}px;"></div>`
      : "",
  ).join("");
  const lastOffset = PLACE_PACKET_BEHIND_OFFSETS[Math.min(members.length, 3) - 2] ?? { left: 0, top: 0 };
  const canvasW = RING_SIZE + lastOffset.left;
  const canvasH = RING_SIZE + lastOffset.top;

  return L.divIcon({
    className: "",
    html: `<div class="place-packet" style="width:${canvasW}px;height:${canvasH}px;">
      ${behindLayers}
      <div class="place-packet-front">${ringPostmarkHtml(members[0])}</div>
      <div class="place-packet-badge">+${members.length}</div>
    </div>`,
    iconSize: [canvasW, canvasH],
    iconAnchor: [RING_CENTER, RING_CENTER],
  });
}

/** Design: design_handoff_flag_map_pins/README.md, option 1b ("perforated
 *  postage stamp"). The first-glance, country-level pin — flag only, no
 *  label or count, tilted like a stamp pressed onto the map rather than
 *  planted on a post. Unicode flag emoji (🇪🇸 etc.) don't render as pictures
 *  on Windows — its default emoji font shows the raw two-letter code
 *  instead, a known, long-standing platform limitation — so this uses real
 *  flag image assets (flag-icons, the RECTANGULAR `fi` variant so tricolours
 *  and cantons stay intact) instead, which look identical on every OS. The
 *  unrecognized-country fallback is a diagonal-stripe fill, never the 🌐
 *  emoji (that was the old countryIcon's fallback; the redesign drops it) —
 *  and, per the README, the same fallback doubles as the "loading" look.
 *  Width/height/state live in globals.css (`.country-stamp-frame` and
 *  friends) rather than inline, since the hover/selected states need real
 *  `:hover`/transition/`prefers-reduced-motion` CSS that inline styles on a
 *  Leaflet divIcon HTML string can't express. */
function countryIcon(
  iso2: string | null,
  tiltKey: string,
  opts: { loading?: boolean } = {},
): L.DivIcon {
  const tilt = tiltForKey(tiltKey);
  const showFallback = opts.loading || !iso2;
  const flagHtml = showFallback
    ? `<span class="country-stamp-flag country-stamp-fallback"></span>`
    : `<span class="country-stamp-flag fi fi-${iso2!.toLowerCase()}"></span>`;
  const stateClass = opts.loading ? " is-loading" : "";

  return L.divIcon({
    className: "",
    html: `<div class="country-stamp-frame${stateClass}" style="--stamp-tilt:${tilt}deg;">${flagHtml}</div>`,
    iconSize: [36, 28],
    iconAnchor: [18, 14],
  });
}

/** Design: README option 2b (country tier), reused for place-tier ring
 *  packets per RING_LABEL.md's "Crowding" section — a packet of 2-3 pins
 *  whose ON-SCREEN positions crowd together at the current zoom (Europe at
 *  low zoom being the canonical country-tier case). "Front" is whichever
 *  member sorts first by the caller's own criterion (page count, for both
 *  tiers); at most two more fan out faded behind it, and a "+n" badge
 *  (n = every member in the packet) sits at the corner. A single member
 *  with nothing nearby is still a "packet" of one — same shape either way,
 *  so the render loop doesn't need a separate branch for the crowded case. */
type ScreenPacket<T> = { key: string; members: T[] };

/** Complete-linkage agglomerative clustering: a packet's on-screen diameter
 *  (the max distance between ANY two of its members, not just adjacent
 *  ones) is capped at `radiusPx`, so every member genuinely looks crowded
 *  against every other member — matches what "a packet" should mean
 *  visually. Repeatedly merges whichever pair of clusters has the smallest
 *  complete-linkage distance, provided that distance is still within
 *  `radiusPx`, until no more merges qualify; picking the globally-smallest
 *  qualifying pair each round means the result doesn't depend on the order
 *  pins arrive in `groups`.
 *
 *  Two earlier approaches were tried and rejected:
 *  - A single-pass anchor-sweep (each packet was whatever fell within
 *    radius of the first not-yet-used pin in `groups` order) made packet
 *    membership depend on incoming array order — e.g. Germany could get
 *    swept into a distant country's packet just because it was near
 *    whichever pin got processed first, while a genuinely close country
 *    dodged the same packet because it wasn't near that specific anchor.
 *  - Union-find single-linkage transitive clustering (A near B, B near C
 *    ⇒ A/B/C cluster, regardless of whether A and C are near each other)
 *    fixed the order-dependence but chained through long strings of
 *    near-neighbors into packets spanning far more of the map than
 *    `radiusPx` — observed live as e.g. a single packet pulling in 10+
 *    countries stretching across most of Europe. Complete-linkage avoids
 *    both failure modes at the cost of leaving a pin ungrouped if it's
 *    close to only *part* of a cluster rather than all of it — an
 *    acceptable trade since the alternative was a visually misleading
 *    "packet."
 *
 *  O(n³)-ish (n² pairs re-scanned per merge, up to n merges) but fine given
 *  neither tier ever has more than a few dozen pins on screen at once.
 *  Generic over the pin type so both the country tier (option 2b) and the
 *  place-tier ring packets (RING_LABEL.md) share one implementation; the
 *  caller supplies how to rank members within a packet since the two
 *  tiers' group types don't share a common "size" field name. */
function groupByScreenProximity<T extends { key: string; lat: number; lng: number }>(
  groups: T[],
  map: L.Map,
  radiusPx: number,
  sortMembers: (a: T, b: T) => number,
): ScreenPacket<T>[] {
  const points = groups.map((g) => map.latLngToContainerPoint([g.lat, g.lng]));

  function completeLinkageDistance(a: number[], b: number[]): number {
    let max = 0;
    for (const i of a) {
      for (const j of b) {
        const d = points[i].distanceTo(points[j]);
        if (d > max) max = d;
      }
    }
    return max;
  }

  const clusters: number[][] = groups.map((_, i) => [i]);
  for (;;) {
    let bestI = -1;
    let bestJ = -1;
    let bestDist = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = completeLinkageDistance(clusters[i], clusters[j]);
        if (dist <= radiusPx && dist < bestDist) {
          bestDist = dist;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI === -1) break;
    clusters[bestI] = clusters[bestI].concat(clusters[bestJ]);
    clusters.splice(bestJ, 1);
  }

  return clusters.map((indices) => {
    const members = indices.map((i) => groups[i]).sort(sortMembers);
    return { key: members.map((m) => m.key).join("+"), members };
  });
}

/** Front-plus-fanned-behind stamps for a crowded packet (README option 2b).
 *  For a packet of exactly one member, callers use the plain `countryIcon`
 *  instead — this is only for genuinely crowded packets. */
function packetIcon(members: CountryGroup[]): L.DivIcon {
  const behindLayers = [1, 2]
    .map((i) => {
      const member = members[i];
      if (!member) return "";
      const iso2 = countryToIso2(member.country);
      const flagHtml = iso2
        ? `<span class="country-stamp-flag is-packet-behind fi fi-${iso2.toLowerCase()}"></span>`
        : `<span class="country-stamp-flag is-packet-behind country-stamp-fallback"></span>`;
      return `<div class="country-stamp-frame is-packet-behind is-packet-behind-${i}">${flagHtml}</div>`;
    })
    .join("");

  const frontIso2 = countryToIso2(members[0].country);
  const frontFlagHtml = frontIso2
    ? `<span class="country-stamp-flag is-packet-front fi fi-${frontIso2.toLowerCase()}"></span>`
    : `<span class="country-stamp-flag is-packet-front country-stamp-fallback"></span>`;

  return L.divIcon({
    className: "",
    html: `<div class="country-packet">
      ${behindLayers}
      <div class="country-stamp-frame is-packet-front">${frontFlagHtml}</div>
      <div class="country-packet-badge">+${members.length}</div>
    </div>`,
    iconSize: [60, 46],
    iconAnchor: [17, 13],
  });
}

/** Renders inside <MapContainer> — useMap/useMapEvents only work as
 *  descendants of it, which is why this can't just live in SummaryMap
 *  itself. Switches between the country overview and individual/clustered
 *  place pins as the map's zoom crosses COUNTRY_ZOOM_THRESHOLD, whether
 *  that's from clicking a country pin or the guest zooming by hand. */
function ZoomAwarePins({
  pins,
  highlightedPlaceKey,
  onPlaceHover,
  initialZoomOffset,
}: {
  pins: MapPin[];
  highlightedPlaceKey?: string | null;
  onPlaceHover?: (key: string | null) => void;
  initialZoomOffset?: number;
}) {
  const router = useRouter();
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  // MapContainer's `bounds` prop is fitted synchronously while the map
  // instance is created (before this child ever mounts) — there's no
  // 'zoomend' event to hook for "after the initial fit", it's already done
  // by the time useMap() returns something usable. useLayoutEffect (once,
  // via the empty dep array) nudges the already-fitted zoom before the
  // browser paints, rather than trying to catch a load/zoomend event that
  // Leaflet doesn't fire for this particular transition. The ref guard
  // matters in dev: React Strict Mode double-invokes mount effects, and
  // without it the offset was silently applying twice (observed: +2 landing
  // on +4 worth of zoom).
  const appliedInitialZoomOffset = useRef(false);
  useLayoutEffect(() => {
    if (initialZoomOffset && !appliedInitialZoomOffset.current) {
      appliedInitialZoomOffset.current = true;
      // animate:false matters here too — an animated setZoom this soon after
      // the initial fitBounds gets silently reverted back to the fitted zoom
      // (observed in dev: getZoom() right after an animated call still read
      // the pre-adjustment value, and stayed that way). Unanimated applies
      // synchronously and sticks.
      map.setZoom(map.getZoom() + initialZoomOffset, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Which country (if any) the guest drilled into to get here — drives the
  // breadcrumb chip at place tier and the "← World" pill's target. No longer
  // highlights the country stamp itself at country tier (dropped per user
  // feedback: the breadcrumb chip already communicates the selection, and
  // since this is only ever cleared by the "← World" pill, not by zoom, a
  // stamp-level highlight would otherwise stay lit after zooming back out
  // past the country tier).
  const [selectedCountryKey, setSelectedCountryKey] = useState<string | null>(null);
  // Drives the bottom place sheet, shown when a place with more than one
  // page is tapped at place tier. Reset below whenever the map drops back to
  // country tier, so a stale sheet can't reappear for an unrelated place if
  // the guest zooms out and back in over different pins later. Adjusted
  // directly during render (React's recommended pattern for state that
  // depends on a prop/state change) rather than in a useEffect, which would
  // cause an extra, avoidable re-render on every tier change.
  const [selectedPlaceKey, setSelectedPlaceKey] = useState<string | null>(null);
  const isCountryTier = zoom < COUNTRY_ZOOM_THRESHOLD;
  const [wasCountryTier, setWasCountryTier] = useState(isCountryTier);
  if (isCountryTier !== wasCountryTier) {
    setWasCountryTier(isCountryTier);
    if (isCountryTier) setSelectedPlaceKey(null);
  }

  // Packets are screen-space, not data-space (README) — they depend on pixel
  // positions that shift on pan even when zoom doesn't change, so a plain
  // `moveend` needs to force a re-render too. The counter's value is never
  // read; bumping it is the only point.
  const [, forcePacketRecompute] = useState(0);

  useMapEvents({
    zoomend: (e) => setZoom(e.target.getZoom()),
    moveend: () => forcePacketRecompute((n) => n + 1),
  });

  // The breadcrumb chip lives in the same top-left corner as Leaflet's
  // default zoom control. Rather than tuck the chip below the control (as
  // before), push the control itself down out of the chip's way — the chip
  // belongs in the actual top-left corner. The offset is applied once, for
  // good, on mount — never toggled based on tier or selection — so the
  // control never visibly moves. Two earlier versions of this both still
  // moved the control: keying the offset to whether a country was selected
  // made it jump every time the chip showed/hid within place tier, and
  // keying it to tier instead just moved the jump to the country↔place
  // transition (zooming out reset the margin, so the control jumped up).
  // Reaches into the Leaflet control's real DOM node (outside React's tree)
  // since react-leaflet doesn't expose a position/offset prop for it.
  useEffect(() => {
    const container = map.zoomControl?.getContainer();
    if (container) container.style.marginTop = "50px";
  }, [map]);

  if (isCountryTier) {
    const packets = groupByScreenProximity(
      groupByCountry(pins),
      map,
      35,
      (a, b) => b.count - a.count,
    );
    return (
      <>
        {packets.map((packet) => {
          const front = packet.members[0];
          const isCrowded = packet.members.length > 1;
          return (
            <Marker
              key={packet.key}
              position={[front.lat, front.lng]}
              icon={
                isCrowded ? packetIcon(packet.members) : countryIcon(countryToIso2(front.country), front.key)
              }
              eventHandlers={{
                click: () => {
                  if (isCrowded) {
                    // Fit to the packet members' own displayed positions
                    // (their centroids) — not every underlying pin. Using
                    // full pin bounds here (as this used to) meant a
                    // country whose own pins are widely spread (e.g. Italy:
                    // Capri to Lake Garda) could dominate the packet's
                    // bounding box on its own, so fitBounds landed on
                    // nearly the same view and the packet never visibly
                    // separated — tapping it looked like it did nothing.
                    // Tapping a packet only re-separates it (README: "does
                    // not open a list"), so it only ever needs to pull the
                    // member stamps apart on screen, not reveal every pin.
                    const bounds = L.latLngBounds(packet.members.map((m) => [m.lat, m.lng] as [number, number]));
                    map.fitBounds(bounds, { padding: [32, 32] });
                    return;
                  }
                  // Plain fitBounds picks whatever zoom fits every pin in
                  // the country, which for a widely-spread country (e.g.
                  // Madrid to Seville) can land below
                  // COUNTRY_ZOOM_THRESHOLD — the map would just recenter
                  // and stay showing the country flag instead of revealing
                  // place pins on the first click. Clamp the computed zoom
                  // into [threshold, 13] so the first click always crosses
                  // into place-tier, and a single-pin country (zero-area
                  // bounds, which would otherwise fit at max zoom) doesn't
                  // land at a near-street-level view either.
                  const bounds = L.latLngBounds(front.bounds);
                  setSelectedCountryKey(front.key);
                  const naturalZoom = map.getBoundsZoom(bounds, false, L.point(32, 32));
                  const targetZoom = Math.min(Math.max(naturalZoom, COUNTRY_ZOOM_THRESHOLD), 13);
                  map.setView(bounds.getCenter(), targetZoom);
                },
              }}
            />
          );
        })}
      </>
    );
  }

  // For the breadcrumb chip: which country (if any) the guest drilled into
  // to get here, and how many distinct PLACES (not pages) it has — the
  // design's "5 PLACES" wording is a place count, so this re-groups the
  // country's own pins by place rather than reusing CountryGroup.count
  // (which is a page count, a different number whenever a place has more
  // than one page). Only the first matching pin's real country/iso2 is used
  // for display — they're all identical within one country group.
  const selectedCountryGroup = selectedCountryKey
    ? groupByCountry(pins).find((g) => g.key === selectedCountryKey)
    : null;
  const selectedCountryPlaceCount = selectedCountryGroup
    ? groupByPlace(pins.filter((p) => (p.country.trim().toLowerCase() || "unknown") === selectedCountryKey))
        .length
    : 0;

  const placeGroups = groupByPlace(pins);
  const selectedPlace = selectedPlaceKey
    ? placeGroups.find((g) => g.key === selectedPlaceKey)
    : null;
  // RING_LABEL.md's "Crowding": rings touch at ~47px separation now that
  // they've been sized down twice (SummaryMap's RING_SIZE), so this reuses
  // the country tier's screen-space grouping with the threshold at 51px
  // (reduced 20% from 64px, itself already reduced 20% from an initial
  // 80px per review), ranked by page count same as the country packets.
  const placePackets = groupByScreenProximity(placeGroups, map, 51, (a, b) => b.pages.length - a.pages.length);

  const allBounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));

  return (
    <>
      {placePackets.map((packet) => {
        const front = packet.members[0];
        const isCrowded = packet.members.length > 1;
        return (
          <Marker
            key={packet.key}
            position={[front.lat, front.lng]}
            icon={
              isCrowded
                ? placePacketIcon(packet.members)
                : postmarkIcon(front, {
                    selected: front.key === selectedPlaceKey || front.key === highlightedPlaceKey,
                  })
            }
            eventHandlers={{
              click: () => {
                if (isCrowded) {
                  // RING_LABEL.md: tapping a packet only re-separates it,
                  // same as the country tier — it does not open a list.
                  const bounds = L.latLngBounds(packet.members.map((m) => [m.lat, m.lng] as [number, number]));
                  map.fitBounds(bounds, { padding: [32, 32] });
                  return;
                }
                if (front.pages.length === 1) {
                  router.push(`/p/${front.pages[0].slug}`);
                } else {
                  setSelectedPlaceKey(front.key);
                }
              },
              mouseover: () => !isCrowded && onPlaceHover?.(front.key),
              mouseout: () => !isCrowded && onPlaceHover?.(null),
            }}
          />
        );
      })}

      {selectedCountryGroup && (
        <div
          // The actual top-left corner — the zoom control gets pushed down
          // out of the way instead (see the marginTop effect above) rather
          // than the chip tucking in below it.
          className="absolute left-[14px] top-[14px] z-[1000] flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3"
          style={{
            background: "rgba(243,237,228,.94)",
            border: "1px solid rgba(34,32,27,.14)",
            boxShadow: "0 1px 3px rgba(34,32,27,.18)",
          }}
        >
          <span
            className={
              countryToIso2(selectedCountryGroup.country)
                ? `fi fi-${countryToIso2(selectedCountryGroup.country)!.toLowerCase()} fis`
                : ""
            }
            style={{
              display: "block",
              width: 20,
              height: 20,
              borderRadius: "9999px",
              boxShadow: "0 0 0 1.5px var(--color-teal)",
              background: countryToIso2(selectedCountryGroup.country)
                ? undefined
                : "repeating-linear-gradient(135deg,#DED5C0 0 4px,#D4CAB3 4px 8px)",
            }}
          />
          <span className="text-ink text-[12.5px] font-semibold">
            {selectedCountryGroup.country}
          </span>
          <span className="font-meta-label text-ink-soft text-[9.5px]">
            {selectedCountryPlaceCount} {selectedCountryPlaceCount === 1 ? "PLACE" : "PLACES"}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setSelectedCountryKey(null);
          setSelectedPlaceKey(null);
          map.fitBounds(allBounds, { padding: [32, 32] });
        }}
        className="text-teal absolute right-[14px] top-[14px] z-[1000] rounded-full px-3 py-1.5 text-[11.5px] font-semibold"
        style={{
          background: "rgba(243,237,228,.94)",
          border: "1px solid rgba(34,32,27,.14)",
          boxShadow: "0 1px 3px rgba(34,32,27,.18)",
        }}
      >
        ← World
      </button>

      {selectedPlace && (
        <div
          className="rounded-card absolute inset-x-0 bottom-0 z-[1000] bg-[var(--color-paper)] px-4 pb-[18px] pt-3.5"
          style={{
            borderTop: "1px solid rgba(34,32,27,.14)",
            boxShadow: "0 -6px 18px rgba(34,32,27,.12)",
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedPlaceKey(null)}
            aria-label="Close"
            className="mx-auto mb-3 block h-[3px] w-[34px] rounded-full"
            style={{ background: "rgba(34,32,27,.2)" }}
          />
          <p className="font-display text-ink text-base font-semibold">{selectedPlace.label}</p>
          <p className="font-meta-label text-ink-soft mt-0.5 text-[9.5px]">
            {selectedPlace.pages.length} {selectedPlace.pages.length === 1 ? "PAGE" : "PAGES"}
            {selectedPlace.pages[0] ? ` · ${selectedPlace.pages[0].albumTitle}` : ""}
          </p>
          {/* Rows run ~34px each; capping at 3 before scrolling keeps the
              sheet from growing arbitrarily tall on a place with many pages. */}
          <div className="mt-1 max-h-[104px] overflow-y-auto">
            {selectedPlace.pages.map((p, i) => (
              <Link
                key={p.id}
                href={`/p/${p.slug}`}
                className={`text-ink flex items-center justify-between py-[9px] text-[13.5px] ${
                  i < selectedPlace.pages.length - 1 ? "border-b" : ""
                }`}
                style={{ borderColor: "rgba(34,32,27,.1)" }}
              >
                {p.header}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function SummaryMap({
  pins,
  heightClassName = "h-64",
  highlightedPlaceKey,
  onPlaceHover,
  initialZoomOffset,
}: SummaryMapProps) {
  const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [32, 32] }}
      scrollWheelZoom={false}
      className={`rounded-card w-full border border-[rgba(34,32,27,0.12)] ${heightClassName}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomAwarePins
        pins={pins}
        highlightedPlaceKey={highlightedPlaceKey}
        onPlaceHover={onPlaceHover}
        initialZoomOffset={initialZoomOffset}
      />
    </MapContainer>
  );
}
