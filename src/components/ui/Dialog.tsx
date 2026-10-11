"use client";

import { useEffect, useId } from "react";

type DialogProps = {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Pinned below the scrolling body (primary actions). */
  footer?: React.ReactNode;
  maxWidth?: number;
  /** Header-less compact dialogs (confirmations) pad the whole card. */
  compact?: boolean;
};

/** Modal: 40% scrim, bottom sheet on mobile, centred card from `sm` up.
 *  The body scrolls internally while header and footer stay fixed. Closes on
 *  Escape and backdrop click. z-[1100] keeps it above Leaflet panes. */
export default function Dialog({ title, onClose, children, footer, maxWidth = 440, compact = false }: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-[1100] flex justify-center bg-black/40 ${compact ? "items-center p-4" : "items-end sm:items-center sm:p-4"}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth }}
        className={`flex w-full flex-col overflow-hidden bg-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] ${
          compact ? "rounded-xl p-6" : "max-h-[88dvh] rounded-t-xl sm:max-h-[600px] sm:rounded-xl"
        }`}
      >
        <div className={`flex items-start justify-between gap-3 ${compact ? "" : "px-6 pb-3 pt-5"}`}>
          <h2 id={titleId} className="font-display text-ink text-lg font-semibold">
            {title}
          </h2>
          {!compact && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-ink-soft hover:text-ink -mr-3 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center"
            >
              ✕
            </button>
          )}
        </div>
        <div className={compact ? "" : "min-h-0 flex-1 overflow-y-auto px-6 pb-2"}>{children}</div>
        {footer && (
          <div className={compact ? "mt-5" : "border-ink/10 border-t px-6 pb-5 pt-3.5"}>{footer}</div>
        )}
      </div>
    </div>
  );
}
