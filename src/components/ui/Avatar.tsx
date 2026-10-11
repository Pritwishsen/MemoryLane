import { AVATAR_TINTS } from "./styles";

/** Initial-letter avatar on a soft tint (guest lists, album cards). */
export function AvatarInitial({
  label,
  index = 0,
  size = 28,
  ring = false,
}: {
  label: string;
  index?: number;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`text-ink flex shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${ring ? "border-2 border-white" : ""}`}
      style={{ width: size, height: size, background: AVATAR_TINTS[index % AVATAR_TINTS.length] }}
    >
      {(label.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Overlapping stack of initials, with a "+N" bubble past `max`. */
export function AvatarStack({ labels, max = 5, size = 28 }: { labels: string[]; max?: number; size?: number }) {
  const shown = labels.slice(0, max);
  const extra = labels.length - shown.length;
  return (
    <div className="flex">
      {shown.map((l, i) => (
        <span key={`${l}-${i}`} style={{ marginLeft: i ? -8 : 0 }}>
          <AvatarInitial label={l} index={i} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="bg-paper text-ink-soft flex items-center justify-center rounded-full border-2 border-white text-[11px]"
          style={{ width: size, height: size, marginLeft: -8 }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
