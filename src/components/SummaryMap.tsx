"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "flag-icons/css/flag-icons.min.css";
import { countryToIso2 } from "@/lib/countries";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  header: string;
  country: string;
  slug: string;
};

type SummaryMapProps = { pins: MapPin[] };

/** Below this zoom the map shows one pin per country (flag + place count);
 *  at or above it, individual pages take over, distance-clustered. Chosen
 *  to roughly match "you can tell countries apart" vs. "you can tell cities
 *  apart" — reasonable for typical country sizes, not tuned per-country. */
const COUNTRY_ZOOM_THRESHOLD = 6;

/** A plain HTML div styled like the app's postmark badge — Leaflet's default
 *  marker icon is a pin graphic loaded from image files that need bundler
 *  config to resolve correctly; a divIcon sidesteps that entirely and keeps
 *  the map on-brand (see Postmark.tsx for the same visual motif). */
function postmarkIcon(label: string): L.DivIcon {
  // Wrapping a place name across lines in a 40px circle reads badly — at
  // this scale it easily orphans a single letter onto its own line. A real
  // postmark shows the town name on one line, so this shrinks the label to
  // fit on one line instead, truncating with an ellipsis only if it still
  // doesn't fit even at the smallest readable size. Space Mono is
  // monospace, so width is predictable from character count without
  // needing to measure text in a canvas.
  const CHAR_WIDTH_RATIO = 0.62;
  // 40px circle, minus the 2px border on each side and 8px of left/right
  // padding on each side — the first/last letter otherwise sizes itself
  // right up to (and visually into) the curved border.
  const USABLE_WIDTH = 20;
  const MIN_FONT_SIZE = 3.5;
  const MAX_FONT_SIZE = 7;

  const upper = label.toUpperCase();
  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(MAX_FONT_SIZE, USABLE_WIDTH / (upper.length * CHAR_WIDTH_RATIO)),
  );

  let text = upper;
  const maxChars = Math.floor(USABLE_WIDTH / (fontSize * CHAR_WIDTH_RATIO));
  if (fontSize === MIN_FONT_SIZE && upper.length > maxChars) {
    text = `${upper.slice(0, Math.max(1, maxChars - 1))}…`;
  }

  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:40px;height:40px;border-radius:9999px;
      border:2px solid var(--color-teal);background:var(--color-paper);
      color:var(--color-teal);font-family:var(--font-meta);
      text-align:center;padding:3px 8px;box-sizing:border-box;
      white-space:nowrap;overflow:hidden;
      transform:rotate(-6deg);box-shadow:0 1px 3px rgba(0,0,0,0.25);
      cursor:pointer;
    "><span style="font-size:${fontSize}px;line-height:1;">${text}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
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

/** The first-glance, country-level pin — a flag badge planted on a flagpost,
 *  like a flag physically stuck into the map at that country. Unicode flag
 *  emoji (🇪🇸 etc.) don't render as pictures on Windows — its default emoji
 *  font shows the raw two-letter code instead, a known, long-standing
 *  platform limitation — so this uses real flag image assets (flag-icons,
 *  the square `fis` variant so it fills a circle cleanly) instead, which
 *  look identical on every OS. Falls back to a globe when the country name
 *  doesn't match a known one (free text the host typed, not a picker). The
 *  anchor point is the base of the post, not the circle center, so the pin
 *  points at the actual location like any other map marker. */
function countryIcon(iso2: string | null): L.DivIcon {
  const flagHtml = iso2
    ? `<span class="fi fi-${iso2.toLowerCase()} fis" style="width:100%;height:100%;background-size:cover;display:block;"></span>`
    : `<span style="font-size:18px;line-height:1;">🌐</span>`;

  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
      <div style="
        display:flex;align-items:center;justify-content:center;overflow:hidden;
        width:34px;height:34px;border-radius:9999px;
        border:2px solid var(--color-teal);background:var(--color-paper);
        box-shadow:0 1px 3px rgba(0,0,0,0.25);
      ">${flagHtml}</div>
      <div style="width:2px;height:14px;background:var(--color-teal);"></div>
    </div>`,
    iconSize: [34, 50],
    iconAnchor: [17, 50],
  });
}

type CountryGroup = {
  key: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  bounds: [number, number][];
};

function groupByCountry(pins: MapPin[]): CountryGroup[] {
  const groups = new Map<string, MapPin[]>();
  for (const pin of pins) {
    const key = pin.country.trim().toLowerCase() || "unknown";
    const list = groups.get(key) ?? [];
    list.push(pin);
    groups.set(key, list);
  }

  return [...groups.entries()].map(([key, list]) => ({
    key,
    country: list[0].country || "Unknown",
    lat: list.reduce((sum, p) => sum + p.lat, 0) / list.length,
    lng: list.reduce((sum, p) => sum + p.lng, 0) / list.length,
    count: list.length,
    bounds: list.map((p) => [p.lat, p.lng] as [number, number]),
  }));
}

type PlaceGroup = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  pages: { id: string; header: string; slug: string }[];
};

/** Two pages at the same named place (e.g. a guest invited to two albums
 *  that both have a "Barcelona" page) would otherwise stack two identical
 *  pins on top of each other. Collapsing them into one pin — before
 *  distance-based clustering even runs — means every place name shows up
 *  on the map exactly once; a click either goes straight to the one page
 *  there, or opens a picker when there's more than one. */
function groupByPlace(pins: MapPin[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const pin of pins) {
    const key = pin.label.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.pages.push({ id: pin.id, header: pin.header, slug: pin.slug });
    } else {
      groups.set(key, {
        key,
        label: pin.label,
        lat: pin.lat,
        lng: pin.lng,
        pages: [{ id: pin.id, header: pin.header, slug: pin.slug }],
      });
    }
  }
  return [...groups.values()];
}

/** Renders inside <MapContainer> — useMap/useMapEvents only work as
 *  descendants of it, which is why this can't just live in SummaryMap
 *  itself. Switches between the country overview and individual/clustered
 *  place pins as the map's zoom crosses COUNTRY_ZOOM_THRESHOLD, whether
 *  that's from clicking a country pin or the guest zooming by hand. */
function ZoomAwarePins({ pins }: { pins: MapPin[] }) {
  const router = useRouter();
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: (e) => setZoom(e.target.getZoom()),
  });

  if (zoom < COUNTRY_ZOOM_THRESHOLD) {
    return (
      <>
        {groupByCountry(pins).map((group) => (
          <Marker
            key={group.key}
            position={[group.lat, group.lng]}
            icon={countryIcon(countryToIso2(group.country))}
            eventHandlers={{
              // Plain fitBounds picks whatever zoom fits every pin in the
              // country, which for a widely-spread country (e.g. Madrid to
              // Seville) can land below COUNTRY_ZOOM_THRESHOLD — the map
              // would just recenter and stay showing the country flag
              // instead of revealing place pins on the first click. Clamp
              // the computed zoom into [threshold, 13] so the first click
              // always crosses into place-tier, and a single-pin country
              // (zero-area bounds, which would otherwise fit at max zoom)
              // doesn't land at a near-street-level view either.
              click: () => {
                const bounds = L.latLngBounds(group.bounds);
                const naturalZoom = map.getBoundsZoom(bounds, false, L.point(32, 32));
                const targetZoom = Math.min(Math.max(naturalZoom, COUNTRY_ZOOM_THRESHOLD), 13);
                map.setView(bounds.getCenter(), targetZoom);
              },
            }}
          />
        ))}
      </>
    );
  }

  return (
    <MarkerClusterGroup
      showCoverageOnHover={false}
      iconCreateFunction={(cluster: L.MarkerCluster) => clusterIcon(cluster.getChildCount())}
    >
      {groupByPlace(pins).map((group) => (
        <Marker
          key={group.key}
          position={[group.lat, group.lng]}
          icon={postmarkIcon(group.label)}
          eventHandlers={
            group.pages.length === 1
              ? { click: () => router.push(`/p/${group.pages[0].slug}`) }
              : undefined
          }
        >
          {group.pages.length > 1 && (
            <Popup minWidth={180} maxWidth={240}>
              <p className="font-meta-label text-ink-soft mb-1 text-xs">{group.label}</p>
              {/* Rows run ~34px each; capping at 3 before scrolling keeps the
                  popup from growing arbitrarily tall on a place with many pages. */}
              <div className="max-h-[102px] overflow-y-auto">
                {group.pages.map((p) => (
                  <Link
                    key={p.id}
                    href={`/p/${p.slug}`}
                    className="text-ink hover:text-teal border-ink/10 block border-b py-1.5 text-sm last:border-b-0"
                  >
                    {p.header}
                  </Link>
                ))}
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MarkerClusterGroup>
  );
}

export default function SummaryMap({ pins }: SummaryMapProps) {
  const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [32, 32] }}
      scrollWheelZoom={false}
      className="rounded-card h-64 w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomAwarePins pins={pins} />
    </MapContainer>
  );
}
