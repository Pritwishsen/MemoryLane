"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import GoogleGlyph from "./GoogleGlyph";

type SignInScreenProps = {
  variant: "host" | "guest";
  /** Overrides the variant's default post-sign-in destination — used by
   *  `/p/[nfcSlug]` so a signed-out guest lands back on the same tag link
   *  they scanned, instead of the generic `/guest` placeholder. */
  callbackUrl?: string;
};

const HELPER_TEXT: Record<SignInScreenProps["variant"], string | null> = {
  host: "Your albums stay private until you invite someone.",
  guest:
    "Guests: you'll only see albums the host has shared their photos with you for.",
};

const CALLBACK_URL: Record<SignInScreenProps["variant"], string> = {
  host: "/dashboard",
  guest: "/guest",
};

export default function SignInScreen({ variant, callbackUrl }: SignInScreenProps) {
  const helperText = HELPER_TEXT[variant];
  const resolvedCallbackUrl = callbackUrl ?? CALLBACK_URL[variant];

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-5 py-8 sm:px-8">
      <div className="w-full max-w-[480px]">
        <Link
          href="/"
          className="font-meta-label text-ink-soft hover:text-ink inline-block"
        >
          ← Back
        </Link>

        <h1 className="font-display text-ink mt-10 text-2xl font-semibold">
          Sign in to continue
        </h1>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: resolvedCallbackUrl })}
          className="border-ink/10 text-ink mt-8 flex w-full items-center justify-center gap-3 rounded-full border bg-white px-6 py-3 font-medium shadow-sm transition hover:shadow-md"
        >
          <GoogleGlyph />
          Continue with Google
        </button>

        {helperText && (
          <p className="text-ink-soft mt-6 text-sm leading-relaxed">
            {helperText}
          </p>
        )}
      </div>
    </main>
  );
}
