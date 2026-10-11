/** Decorative circular postmark with its label curved round the inside of
 *  the ring (login hero, empty states). Server-safe. For list/map badges
 *  that must fit arbitrary place names use FittedPostmark instead. */
export default function RingStamp({
  label,
  id,
  size = 96,
  fontSize = 10,
  letterSpacing = 1.2,
  tilt = -6,
}: {
  label: string;
  /** Unique per page — textPath hrefs resolve document-wide. */
  id: string;
  size?: number;
  fontSize?: number;
  letterSpacing?: number;
  tilt?: number;
}) {
  const c = size / 2;
  const r = size * 0.34;
  const disc = size * 0.34;
  const pathId = `ring-stamp-${id}`;
  return (
    <div
      aria-hidden="true"
      className="border-teal bg-paper relative shrink-0 rounded-full border-2"
      style={{
        width: size,
        height: size,
        transform: `rotate(${tilt}deg)`,
        boxShadow: "0 4px 12px rgba(34,32,27,0.18)",
      }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <path id={pathId} d={`M${c},${c + r} a${r},${r} 0 1,1 0,-${2 * r} a${r},${r} 0 1,1 0,${2 * r}`} />
        </defs>
        <text
          style={{ fontFamily: "var(--font-meta)", fontWeight: 700, fontSize, letterSpacing }}
          fill="var(--color-teal)"
        >
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {label}
          </textPath>
        </text>
      </svg>
      <div
        className="bg-teal/10 border-teal/45 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ width: disc, height: disc }}
      />
    </div>
  );
}
