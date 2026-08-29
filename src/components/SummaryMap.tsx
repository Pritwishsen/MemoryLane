"use client";

import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPin = { id: string; lat: number; lng: number; label: string; slug: string };

type SummaryMapProps = { pins: MapPin[] };

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

export default function SummaryMap({ pins }: SummaryMapProps) {
  const router = useRouter();
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
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={postmarkIcon(pin.label)}
          eventHandlers={{ click: () => router.push(`/p/${pin.slug}`) }}
        />
      ))}
    </MapContainer>
  );
}
