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
