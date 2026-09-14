/**
 * Layout math for the curved ring postmark label used by both the map's
 * Leaflet pins (SummaryMap.tsx's postmarkIcon(), design_handoff_flag_map_pins
 * /RING_LABEL.md option 7b) and the list/footer badge (FittedPostmark.tsx) —
 * text running along the inside of a ring instead of shrinking to fit a flat
 * circle. 8px is a hard floor (never interpolated down the way the old flat
 * badge used to); length is instead absorbed by letter-spacing, and only a
 * name past the ring's ~26-character capacity at the tightest spacing gets
 * truncated.
 */
const RING_MAX_CHARS = 26;

export function ringLabelLayout(label: string): { text: string; letterSpacing: string } {
  const upper = label.toUpperCase();
  const text = upper.length > RING_MAX_CHARS ? `${upper.slice(0, RING_MAX_CHARS - 1)}…` : upper;
  const len = text.length;
  const letterSpacing =
    len <= 7 ? "0.12em" : len <= 11 ? "0.10em" : len <= 15 ? "0.08em" : len <= 20 ? "0.04em" : "0.02em";
  return { text, letterSpacing };
}

/** RING_LABEL.md's non-Latin fallback: CJK/Devanagari/etc. set much wider per
 *  character and don't tolerate letter-spacing, so those names skip the
 *  curved ring text entirely and go in the inner disc instead. Latin-1 +
 *  Latin Extended-A/B (through U+024F) covers accented Western/Central
 *  European names (café, Zürich, Kraków) as "Latin" for this purpose. */
export function isNonLatinText(text: string): boolean {
  return [...text].some((ch) => (ch.codePointAt(0) ?? 0) > 0x24f);
}
