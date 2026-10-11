// Shared class recipes for the redesign's buttons, chips and back links.
// Plain module (no "use client") so Server Components can use these on
// <Link>/<a> as well as client components on <button>.

export type ButtonVariant = "primary" | "secondary" | "danger" | "danger-outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-teal text-white hover:bg-teal/90",
  secondary: "border border-teal text-teal hover:bg-teal/5",
  danger: "bg-stamp text-white hover:bg-stamp/90",
  "danger-outline": "border border-stamp/40 text-stamp hover:bg-stamp/5",
  ghost: "border border-ink/20 text-ink hover:bg-ink/5",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 py-1.5 text-[13px]",
  md: "min-h-10 px-5 py-2 text-sm",
  lg: "min-h-11 px-6 py-3 text-[15px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return [
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    extra,
  ].join(" ");
}

/** Back links: Inter 500 14px teal, sentence case, 44px tall touch target. */
export const backLinkClass =
  "text-teal hover:text-ink inline-flex min-h-11 items-center text-sm font-medium";

export type GuestStatus = "viewed" | "invited" | "needs-access";

export const GUEST_STATUS_LABEL: Record<GuestStatus, string> = {
  viewed: "Viewed",
  invited: "Invited",
  "needs-access": "Needs Drive access",
};

export const GUEST_STATUS_CLASS: Record<GuestStatus, string> = {
  viewed: "bg-chip-viewed text-teal",
  invited: "bg-chip-invited text-ink-soft",
  "needs-access": "bg-chip-needs text-stamp",
};

/** Soft background tints for initial avatars, cycled by index. */
export const AVATAR_TINTS = ["#E7DFCC", "#D5DFD9", "#EADBC0", "#DCD5E6", "#D9E2EC"];
