import { tiltForKey } from "@/lib/mapGrouping";
import { ringLabelLayout, isNonLatinText } from "@/lib/postmarkLabel";

type FittedPostmarkProps = {
  label: string;
  /** Distinguishes this badge's SVG textPath id from every other one on the
   *  same page — two rows can share a label (two pages both called
   *  "Rome"), and textPath's `href` resolves document-wide, so falling
   *  back to the label alone would make duplicates all render the first
   *  one's curved text (same gotcha as SummaryMap.tsx's ringPostmarkHtml).
   *  Pass something page-unique (e.g. the page id); omit only when the
   *  caller can guarantee the label itself is unique on the page. */
  idHint?: string;
  /** Circle diameter in px. Both current uses (album summary page rows,
   *  the page-view "next in this album" footer) want 44px per
   *  GUEST_SCREENS.md, but this stays a prop rather than hardcoded so a
   *  future spot isn't forced to match. */
  sizePx?: number;
  selected?: boolean;
};

// Proportions carried over from SummaryMap.tsx's map-pin ring (RING_SIZE 59,
// RING_TEXT_RADIUS 20, disc 21px, non-Latin disc 35px) so this list/footer
// badge reads as the same shape at a smaller size, just scaled down.
const TEXT_RADIUS_RATIO = 20 / 59;
const DISC_RATIO = 21 / 59;
const NAME_DISC_RATIO = 35 / 59;

/**
 * A postmark badge matching the map's curved-ring place pin (SummaryMap.tsx's
 * ringPostmarkHtml(), design_handoff_flag_map_pins/RING_LABEL.md) at list
 * scale — the label runs on a curved SVG textPath along the inside of the
 * ring rather than shrinking to fit a flat circle, so the guest album
 * summary list and the map use the same visual language for "a place".
 * Server-safe (no "use client" needed — no hooks, no browser APIs), so this
 * also renders fine from the page-view server component's sticky footer.
 */
export default function FittedPostmark({
  label,
  idHint,
  sizePx = 44,
  selected = false,
}: FittedPostmarkProps) {
  const center = sizePx / 2;
  const key = (idHint ?? label).trim().toLowerCase();
  const tilt = tiltForKey(key);
  const pathId = `fitted-ring-${key.replace(/[^a-z0-9]/gi, "") || "x"}`;
  const ringColor = selected ? "var(--color-brass)" : "var(--color-teal)";

  const frameStyle = {
    width: sizePx,
    height: sizePx,
    border: `2px solid ${ringColor}`,
    background: "var(--color-paper)",
    transform: `rotate(${tilt}deg)`,
    boxSizing: "border-box" as const,
  };

  if (isNonLatinText(label)) {
    // CJK/Devanagari/etc. — same fallback as the map: ring left blank, name
    // goes in a bigger inner disc instead.
    const discSize = sizePx * NAME_DISC_RATIO;
    return (
      <div className="relative shrink-0 rounded-full" style={frameStyle}>
        <div
          className="absolute flex items-center justify-center overflow-hidden rounded-full text-center uppercase"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: discSize,
            height: discSize,
            background: "rgba(31,78,74,.08)",
            border: "1px solid rgba(31,78,74,.45)",
            color: "var(--color-teal)",
            fontFamily: "var(--font-meta)",
            fontWeight: 700,
            fontSize: 9,
            lineHeight: 1.15,
            padding: 2,
          }}
        >
          {label.toUpperCase()}
        </div>
      </div>
    );
  }

  const { text, letterSpacing } = ringLabelLayout(label);
  const textRadius = sizePx * TEXT_RADIUS_RATIO;
  const discSize = sizePx * DISC_RATIO;
  const d = `M${center},${center} m-${textRadius},0 a${textRadius},${textRadius} 0 1,1 ${textRadius * 2},0 a${textRadius},${textRadius} 0 1,1 -${textRadius * 2},0`;

  return (
    <div className="relative shrink-0 rounded-full" style={frameStyle}>
      <svg
        viewBox={`0 0 ${sizePx} ${sizePx}`}
        style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
      >
        <defs>
          <path id={pathId} d={d} />
        </defs>
        <text
          style={{
            fontFamily: "var(--font-meta)",
            fontWeight: 700,
            fontSize: 8,
            fill: "var(--color-teal)",
            textTransform: "uppercase",
            letterSpacing,
          }}
        >
          <textPath href={`#${pathId}`} startOffset="25%" textAnchor="middle">
            {text}
          </textPath>
        </text>
      </svg>
      {/* Inner disc — always empty here (unlike the map's ring, one page per
          badge means there's no page count to show). */}
      <div
        className="absolute rounded-full"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: discSize,
          height: discSize,
          background: "rgba(31,78,74,.08)",
          border: "1px solid rgba(31,78,74,.45)",
        }}
      />
    </div>
  );
}
