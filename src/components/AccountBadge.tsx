"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { signIn, signOut } from "next-auth/react";

type AccountBadgeProps = {
  name: string | null;
  image: string | null;
  email?: string | null;
  /** Where sign-out sends you — defaults to the landing page for every
   *  surface (host dashboard and guest-facing pages alike). */
  callbackUrl?: string;
};

/** Avatar button used the same way on every signed-in screen, host and
 *  guest alike: shows who's signed in, and opens a small menu with an
 *  explicit "Sign out" action — clicking the avatar itself used to sign you
 *  out immediately, which meant one misclick logged you out with no
 *  confirmation. One shared component so every screen stays visually and
 *  behaviorally identical rather than drifting apart. */
export default function AccountBadge({
  name,
  image,
  email,
  callbackUrl = "/",
}: AccountBadgeProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={name ?? "Account"}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="border-ink/15 h-11 w-11 shrink-0 overflow-hidden rounded-full border"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? "Your account"}
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="bg-paper-dim text-ink flex h-full w-full items-center justify-center text-[13px] font-medium">
            {name?.[0] ?? "?"}
          </span>
        )}
      </button>

      {open && (
        // z-[1100]: on the guest summary page this menu sits right above a
        // Leaflet map, whose own panes/controls use z-index up to 1000 —
        // anything lower gets rendered behind the map wherever they overlap.
        <div
          role="menu"
          className="border-ink/10 absolute right-0 top-[52px] z-[1100] w-60 overflow-hidden rounded-xl border bg-white shadow-[0_10px_24px_rgba(34,32,27,0.18)]"
        >
          {(name || email) && (
            <div className="border-ink/10 border-b px-4 py-3.5">
              {name && <p className="text-ink truncate text-sm font-semibold">{name}</p>}
              {email && <p className="text-ink-soft mt-0.5 truncate text-xs">{email}</p>}
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            // Re-run Google sign-in with the account chooser forced open; a
            // successful pick replaces the current session.
            onClick={() => signIn("google", { callbackUrl: "/" }, { prompt: "select_account consent" })}
            className="text-ink hover:bg-paper flex min-h-11 w-full items-center px-4 py-3 text-left text-sm"
          >
            Switch account
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl })}
            className="text-stamp hover:bg-paper border-ink/10 flex min-h-11 w-full items-center border-t px-4 py-3 text-left text-sm"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
