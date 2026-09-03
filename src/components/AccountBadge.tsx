"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";

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
        className="border-ink/10 h-9 w-9 shrink-0 overflow-hidden rounded-full border"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? "Your account"}
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="bg-paper-dim flex h-full w-full items-center justify-center text-xs">
            {name?.[0] ?? "?"}
          </span>
        )}
      </button>

      {open && (
        // z-[1100]: on the guest summary page this menu sits right above a
        // Leaflet map, whose own panes/controls use z-index up to 1000 —
        // anything lower gets rendered behind the map wherever they overlap.
        <div className="border-ink/10 rounded-card absolute right-0 top-11 z-[1100] w-52 border bg-white py-1.5 shadow-lg">
          {(name || email) && (
            <div className="border-ink/10 border-b px-3 pb-2">
              {name && <p className="text-ink truncate text-sm font-medium">{name}</p>}
              {email && <p className="text-ink-soft truncate text-xs">{email}</p>}
            </div>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl })}
            className="text-ink hover:bg-paper-dim mt-1 block w-full px-3 py-1.5 text-left text-sm"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
