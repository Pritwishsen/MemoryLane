/**
 * Nominatim's usage policy requires a descriptive User-Agent (no API key
 * needed otherwise) — see https://operations.osmfoundation.org/policies/nominatim/.
 * Result is cached on the page doc (lat/lng) by the caller so this only ever
 * runs once per distinct location name, not on every page load.
 */
export async function geocodeLocation(
  locationName: string
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = locationName.trim();
  if (!trimmed) return null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "MemoryLane/1.0 (personal memory-album app)" },
    });
    if (!res.ok) return null;

    const results: Array<{ lat: string; lon: string }> = await res.json();
    const first = results[0];
    if (!first) return null;

    return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
  } catch {
    return null;
  }
}
