"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "flag-icons/css/flag-icons.min.css";
import { countryToIso2 } from "@/lib/countries";
import { fitPostmarkLabel } from "@/lib/postmarkLabel";
import {
  groupByCountry,
  groupByPlace,
  tiltForKey,
  type MapPin,
  type CountryGroup,
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
};

/** Below this zoom the map shows one pin per country (flag + place count);
 *  at or above it, individual pages take over, distance-clustered. Chosen
 *  to roughly match "you can tell countries apart" vs. "you can tell cities
 *  apart" — reasonable for typical country sizes, not tuned per-country. */
const COUNTRY_ZOOM_THRESHOLD = 6;

/** A plain HTML div styled like the app's postmark badge — Leaflet's default
 *  marker icon is a pin graphic loaded from image files that need bundler
 *  config to resolve correctly; a divIcon sidesteps that entirely and keeps
 *  the map on-brand (see Postmark.tsx for the same visual motif). Label
 *  sizing/truncation math lives in lib/postmarkLabel.ts, shared with the
 *  non-Leaflet page-row postmark badge on the guest album summary screen. */
function postmarkIcon(label: string, selected = false): L.DivIcon {
  // 48px circle, minus the 2px border on each side and 4px of left/right
  // padding on each side — the first/last letter otherwise sizes itself
  // right up to (and visually into) the curved border. ~36px usable width.
  const { fontSize, text } = fitPostmarkLabel(label, 36);
  const ringColor = selected ? "var(--color-brass)" : "var(--color-teal)";

  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:48px;height:48px;border-radius:9999px;
      border:2px solid ${ringColor};background:var(--color-paper);
      color:var(--color-teal);font-family:var(--font-meta);
      text-align:center;padding:3px 4px;box-sizing:border-box;
      white-space:nowrap;overflow:hidden;
      transform:rotate(-6deg);box-shadow:0 1px 3px rgba(0,0,0,0.25);
      cursor:pointer;
    "><span style="font-size:${fontSize}px;line-height:1;letter-spacing:0.02em;">${text}</span></div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

/** Same postmark visual language, filled solid, for a cluster of pages too
 *  close together to tell apart as separate pins at the current zoom. */
function clusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:44px;height:44px;border-radius:9999px;
      border:2px solid var(--color-teal);background:var(--color-teal);
      color:var(--color-paper);font-family:var(--font-meta);
      font-size:14px;font-weight:700;
      transform:rotate(-6deg);box-shadow:0 1px 3px rgba(0,0,0,0.25);
      cursor:pointer;
    ">${count}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
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
  opts: { selected?: boolean; loading?: boolean } = {},
): L.DivIcon {
  const tilt = tiltForKey(tiltKey);
  const showFallback = opts.loading || !iso2;
  const flagHtml = showFallback
    ? `<span class="country-stamp-flag country-stamp-fallback"></span>`
    : `<span class="country-stamp-flag fi fi-${iso2!.toLowerCase()}"></span>`;
  const stateClass = opts.selected ? " is-selected" : opts.loading ? " is-loading" : "";

  return L.divIcon({
    className: "",
    html: `<div class="country-stamp-frame${stateClass}" style="--stamp-tilt:${tilt}deg;">${flagHtml}</div>`,
    iconSize: [36, 28],
    iconAnchor: [18, 14],
  });
}

/** Design: README option 2b. A packet of 2-3 country stamps whose ON-SCREEN
 *  positions crowd together at the current zoom (Europe at low zoom being
 *  the canonical case) — front stamp is whichever member has the most
 *  pages, at most two more fan out faded behind it, and a "+n" badge
 *  (n = every country in the packet) sits at the corner. A single member
 *  with nothing nearby is still a "packet" of one — same shape either way,
 *  so the render loop doesn't need a separate branch for the crowded case. */
type CountryPacket = { key: string; members: CountryGroup[]; bounds: [number, number][] };

/** Simplified single-pass clustering: each packet's membership is whatever
 *  falls within `radiusPx` of the FIRST not-yet-used pin encountered (in
 *  `groups` order), not a full transitive nearest-neighbor chain. That can
 *  occasionally miss merging two pins that are each close to a shared third
 *  pin but not to each other — an acceptable trade for staying O(n²) and
 *  simple, given country tier never has more than a few dozen pins. */
function groupByScreenProximity(groups: CountryGroup[], map: L.Map, radiusPx: number): CountryPacket[] {
  const points = groups.map((g) => ({ group: g, pt: map.latLngToContainerPoint([g.lat, g.lng]) }));
  const used = new Set<string>();
  const packets: CountryPacket[] = [];

  for (const anchor of points) {
    if (used.has(anchor.group.key)) continue;
    used.add(anchor.group.key);
    const clique = [anchor.group];
    for (const other of points) {
      if (used.has(other.group.key)) continue;
      if (anchor.pt.distanceTo(other.pt) <= radiusPx) {
        used.add(other.group.key);
        clique.push(other.group);
      }
    }
    const members = clique.sort((a, b) => b.count - a.count);
    packets.push({
      key: members.map((m) => m.key).join("+"),
      members,
      bounds: members.flatMap((m) => m.bounds),
    });
  }
  return packets;
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
}: {
  pins: MapPin[];
  highlightedPlaceKey?: string | null;
  onPlaceHover?: (key: string | null) => void;
}) {
  const router = useRouter();
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  // Drives the brass "selected" outline + one-shot pulse on the country pin
  // whose bounds the map is currently entering, and (step 5) the breadcrumb
  // chip at place tier. Only ever cleared by the "← World" pill, per the
  // design spec — not by zoom — so it's still correct if the guest zooms
  // back out to the country tier after drilling in.
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

  if (isCountryTier) {
    const packets = groupByScreenProximity(groupByCountry(pins), map, 44);
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
                isCrowded
                  ? packetIcon(packet.members)
                  : countryIcon(countryToIso2(front.country), front.key, {
                      selected: front.key === selectedCountryKey,
                    })
              }
              eventHandlers={{
                click: () => {
                  const bounds = L.latLngBounds(packet.bounds);
                  if (isCrowded) {
                    // Tapping a packet only re-separates it (README: "does
                    // not open a list") — fitBounds naturally zooms in
                    // enough to pull the crowded pins apart on screen.
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

  const allBounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));

  return (
    <>
      <MarkerClusterGroup
        showCoverageOnHover={false}
        iconCreateFunction={(cluster: L.MarkerCluster) => clusterIcon(cluster.getChildCount())}
      >
        {placeGroups.map((group) => (
          <Marker
            key={group.key}
            position={[group.lat, group.lng]}
            icon={postmarkIcon(
              group.label,
              group.key === selectedPlaceKey || group.key === highlightedPlaceKey,
            )}
            eventHandlers={{
              click: () =>
                group.pages.length === 1
                  ? router.push(`/p/${group.pages[0].slug}`)
                  : setSelectedPlaceKey(group.key),
              mouseover: () => onPlaceHover?.(group.key),
              mouseout: () => onPlaceHover?.(null),
            }}
          />
        ))}
      </MarkerClusterGroup>

      {selectedCountryGroup && (
        <div
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
      <ZoomAwarePins pins={pins} highlightedPlaceKey={highlightedPlaceKey} onPlaceHover={onPlaceHover} />
    </MapContainer>
  );
}
