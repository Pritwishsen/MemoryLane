/**
 * Pure pin-grouping helpers shared between the map itself (SummaryMap.tsx,
 * a "use client" component) and Server Components that need the same
 * counts/groupings for non-map UI (e.g. the guest landing page's summary
 * chip). This file deliberately has NO "use client" directive — every
 * export of a "use client" module becomes a client reference as far as the
 * Next.js RSC boundary is concerned, so a Server Component can't call a
 * plain function from one even if the function itself does nothing
 * client-specific. Keeping these here, directive-free, is what makes them
 * safely callable from both sides.
 */
export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  header: string;
  country: string;
  slug: string;
  /** For the place sheet's meta line ("3 PAGES · SUMMER IN RAJASTHAN"),
   *  design_handoff_flag_map_pins/README.md. */
  albumTitle: string;
};

export type CountryGroup = {
  key: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  bounds: [number, number][];
};

export function groupByCountry(pins: MapPin[]): CountryGroup[] {
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

export type PlaceGroup = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  pages: { id: string; header: string; slug: string; albumTitle: string }[];
};

/** Two pages at the same named place (e.g. a guest invited to two albums
 *  that both have a "Barcelona" page) would otherwise stack two identical
 *  pins on top of each other. Collapsing them into one pin — before
 *  distance-based clustering even runs — means every place name shows up
 *  on the map exactly once; a click either goes straight to the one page
 *  there, or opens a picker when there's more than one. */
export function groupByPlace(pins: MapPin[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const pin of pins) {
    const key = pin.label.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.pages.push({ id: pin.id, header: pin.header, slug: pin.slug, albumTitle: pin.albumTitle });
    } else {
      groups.set(key, {
        key,
        label: pin.label,
        lat: pin.lat,
        lng: pin.lng,
        pages: [{ id: pin.id, header: pin.header, slug: pin.slug, albumTitle: pin.albumTitle }],
      });
    }
  }
  return [...groups.values()];
}

/** Stable per-country/per-place tilt so a flag or postmark never jitters
 *  between renders — hashes the given key into a value in [-8, 8] degrees.
 *  Deliberately simple (not cryptographic); only needs to be stable and
 *  roughly spread out, not collision-resistant. */
export function tiltForKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 17) - 8;
}
