type PostmarkProps = {
  /** Location name or short label shown inside the stamp. Omit for a purely decorative icon. */
  label?: string;
  size?: "sm" | "md" | "lg";
  /** Tilt angle in degrees — the signature "postmark" look. */
  rotate?: number;
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<PostmarkProps["size"]>, string> = {
  sm: "h-9 w-9 border text-[0.5rem]",
  md: "h-16 w-16 border-2 text-[0.6rem]",
  lg: "h-24 w-24 border-2 text-xs",
};

/**
 * The one recurring visual motif that ties the app together: a circular,
 * slightly rotated stamp badge. Reused as-is across map pins, page-view
 * headers, and NFC-tag icons in the album editor — don't fork this into a
 * second "badge" component for those, just vary size/label.
 */
export default function Postmark({
  label,
  size = "md",
  rotate = -6,
  className = "",
}: PostmarkProps) {
  return (
    <div
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-teal text-teal ${SIZE_CLASSES[size]} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {label ? (
        <span className="font-meta-label px-1 text-center leading-tight">
          {label}
        </span>
      ) : (
        <span className="h-1/3 w-1/3 rounded-full border border-teal bg-teal/10" />
      )}
    </div>
  );
}
