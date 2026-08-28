import Link from "next/link";
import GoogleGlyph from "./GoogleGlyph";

type SignInScreenProps = {
  variant: "host" | "guest";
};

const HELPER_TEXT: Record<SignInScreenProps["variant"], string | null> = {
  host: "Your albums stay private until you invite someone.",
  guest:
    "Guests: you'll only see albums the host has shared their photos with you for.",
};

export default function SignInScreen({ variant }: SignInScreenProps) {
  const helperText = HELPER_TEXT[variant];

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

        {/*
          TODO(Phase 2): wire this up to NextAuth's Google provider (signIn("google")).
          Left as a non-functional placeholder for now, per the phased build plan.
        */}
        <button
          type="button"
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
