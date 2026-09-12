import { tiltForKey } from "@/lib/mapGrouping";
import { fitPostmarkLabel } from "@/lib/postmarkLabel";

type FittedPostmarkProps = {
  label: string;
  /** Circle diameter in px. Both current uses (album summary page rows,
   *  the page-view "next in this album" footer) want 44px per
   *  GUEST_SCREENS.md, but this stays a prop rather than hardcoded so a
   *  future spot isn't forced to match. */
  sizePx?: number;
  selected?: boolean;
};

/**
 * A postmark badge that shrinks its label to fit on one line and truncates
 * with "…" rather than going below the 8px floor — the same rule
 * SummaryMap.tsx's Leaflet postmarkIcon() enforces on the map, shared via
 * lib/postmarkLabel.ts. `Postmark.tsx` (the app's other postmark component)
 * intentionally doesn't do this: it's used for short, known-fits labels
 * elsewhere, so forcing shrink/truncate logic into it for these two spots
 * would be the wrong direction to generalize. Server-safe (no "use client"
 * needed — no hooks, no browser APIs), so this also renders fine from the
 * page-view server component's sticky footer.
 */
export default function FittedPostmark({ label, sizePx = 44, selected = false }: FittedPostmarkProps) {
  // 2px border + 3px padding each side.
  const usableWidth = sizePx - 2 * 2 - 2 * 3;
  const { fontSize, text } = fitPostmarkLabel(label, usableWidth);
  const tilt = tiltForKey(label.trim().toLowerCase());

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 text-center"
      style={{
        width: sizePx,
        height: sizePx,
        borderColor: selected ? "var(--color-brass)" : "var(--color-teal)",
        background: "var(--color-paper)",
        color: "var(--color-teal)",
        fontFamily: "var(--font-meta)",
        transform: `rotate(${tilt}deg)`,
        boxSizing: "border-box",
        padding: "3px",
        overflow: "hidden",
      }}
    >
      <span style={{ fontSize, lineHeight: 1, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
        {text}
      </span>
    </div>
  );
}
