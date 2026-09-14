/**
 * Shared shrink-to-fit + truncate math for postmark-style circular labels —
 * used by the map's Leaflet divIcon postmark pins (SummaryMap.tsx) and the
 * page-row postmark badges on the guest album summary screen
 * (AlbumSummaryClient.tsx), so both surfaces size/truncate identically
 * instead of drifting into two slightly different implementations.
 *
 * Wrapping a place name across lines in a small circle reads badly — at this
 * scale it easily orphans a single letter onto its own line. A real postmark
 * shows the town name on one line, so this shrinks the label to fit on one
 * line instead, truncating with an ellipsis rather than shrinking below the
 * 8px floor (design review: below that it stops being legible at all, so a
 * short truncated label beats a longer unreadable one). Space Mono is
 * monospace, so width is predictable from character count without needing
 * to measure text in a canvas.
 */
const CHAR_WIDTH_RATIO = 0.62;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 11.5;

export function fitPostmarkLabel(
  label: string,
  usableWidthPx: number,
): { fontSize: number; text: string } {
  const upper = label.toUpperCase();
  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(MAX_FONT_SIZE, usableWidthPx / (upper.length * CHAR_WIDTH_RATIO)),
  );

  let text = upper;
  const maxChars = Math.floor(usableWidthPx / (fontSize * CHAR_WIDTH_RATIO));
  if (fontSize === MIN_FONT_SIZE && upper.length > maxChars) {
    text = `${upper.slice(0, Math.max(1, maxChars - 1))}…`;
  }
  return { fontSize, text };
}

/**
 * Layout math for the map's curved ring postmark label (SummaryMap.tsx's
 * postmarkIcon(), design_handoff_flag_map_pins/RING_LABEL.md option 7b) —
 * text running along the inside of a 74px ring instead of shrinking to fit
 * a flat circle. 8px is a hard floor here (never interpolated down like
 * fitPostmarkLabel's flat badge does); length is instead absorbed by
 * letter-spacing, and only a name past the ring's ~26-character capacity at
 * the tightest spacing gets truncated.
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
