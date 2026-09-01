"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
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
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:40px;height:40px;border-radius:9999px;
      border:2px solid var(--color-teal);background:var(--color-paper);
      color:var(--color-teal);font-family:var(--font-meta);
      font-size:7px;text-align:center;line-height:1.1;padding:2px;
      text-transform:uppercase;letter-spacing:0.03em;
      transform:rotate(-6deg);box-shadow:0 1px 3px rgba(0,0,0,0.25);
      cursor:pointer;
    ">${label}</div>`,
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

/** The first-glance, country-level pin — flag on top, place count below.
 *  Unicode flag emoji (🇪🇸 etc.) don't render as pictures on Windows —
 *  its default emoji font shows the raw two-letter code instead, a known,
 *  long-standing platform limitation — so this uses real flag image assets
 *  (flag-icons) instead, which look identical on every OS. Falls back to a
 *  globe when the country name doesn't match a known one (free text the
 *  host typed, not a picker). */
function countryIcon(iso2: string | null, count: number): L.DivIcon {
  const flagHtml = iso2
    ? `<span class="fi fi-${iso2.toLowerCase()}" style="width:26px;height:19px;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></span>`
    : `<span style="font-size:20px;line-height:1;">🌐</span>`;

  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      width:52px;height:52px;border-radius:9999px;
      border:2px solid var(--color-teal);background:var(--color-paper);
      color:var(--color-teal);font-family:var(--font-meta);
      box-shadow:0 1px 3px rgba(0,0,0,0.25);cursor:pointer;
      transform:rotate(-6deg);
    ">
      ${flagHtml}
      <span style="font-size:10px;font-weight:700;margin-top:3px;">${count}</span>
    </div>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
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
            icon={countryIcon(countryToIso2(group.country), group.count)}
            eventHandlers={{
              click: () => map.fitBounds(group.bounds, { padding: [32, 32] }),
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
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={postmarkIcon(pin.label)}
          eventHandlers={{ click: () => router.push(`/p/${pin.slug}`) }}
        />
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
