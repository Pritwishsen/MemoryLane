"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";

type AccountBadgeProps = {
  name: string | null;
  image: string | null;
  /** Where sign-out sends you — defaults to the landing page for every
   *  surface (host dashboard and guest-facing pages alike). */
  callbackUrl?: string;
};

/** Small avatar button, used the same way on host and guest pages: shows
 *  who's signed in, and doubles as the sign-out control (per-page "who am I
 *  / log off" request) — one shared component so both surfaces stay
 *  visually and behaviorally identical rather than drifting apart. */
export default function AccountBadge({ name, image, callbackUrl = "/" }: AccountBadgeProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      title={name ? `Sign out (${name})` : "Sign out"}
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
  );
}
