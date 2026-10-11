"use client";

import Link from "next/link";
import { backLinkClass } from "@/components/ui/styles";
import LoginButton from "./LoginButton";

type SignInScreenProps = {
  variant: "host" | "guest";
  /** Overrides the variant's default post-sign-in destination — used by
   *  `/p/[nfcSlug]` so a signed-out guest lands back on the same tag link
   *  they scanned, instead of the generic `/guest` placeholder. */
  callbackUrl?: string;
};

const HELPER_TEXT: Record<SignInScreenProps["variant"], string> = {
  host: "Your albums stay private until you invite someone.",
  guest: "Sign in with the Google account your host invited.",
};

const CALLBACK_URL: Record<SignInScreenProps["variant"], string> = {
  host: "/dashboard",
  guest: "/guest",
};

/** Deep-link sign-in (tag links, invite links, /guest, /create). The main
 *  front door is the Login page at `/`; this is the compact version. */
export default function SignInScreen({ variant, callbackUrl }: SignInScreenProps) {
  const resolvedCallbackUrl = callbackUrl ?? CALLBACK_URL[variant];

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-5 py-8 sm:px-8">
      <div className="w-full max-w-[400px]">
        <Link href="/" className={backLinkClass}>
          ← Back
        </Link>

        <span className="font-meta-label text-gold mt-8 block text-[11px] tracking-[0.14em]">
          MemoryLane
        </span>
        <h1 className="font-display text-ink mt-2 text-2xl font-semibold">Sign in to continue</h1>

        <div className="mt-7">
          <LoginButton callbackUrl={resolvedCallbackUrl} />
        </div>

        <p className="text-ink-soft mt-4 text-sm leading-relaxed">{HELPER_TEXT[variant]}</p>

        <div className="border-ink/10 mt-5 flex items-start gap-2.5 border-t pt-4">
          <span className="border-teal text-teal flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-semibold">
            i
          </span>
          <p className="text-ink-soft text-[13px] leading-normal">
            Your photos stay in your Google Drive. MemoryLane only reads the folders you choose to share.
          </p>
        </div>
      </div>
    </main>
  );
}
