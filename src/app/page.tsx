import Link from "next/link";
import Postmark from "@/components/Postmark";

export default function LandingPage() {
  return (
    <main className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden px-5 py-8 sm:px-8">
      {/* Faint oversized ring behind the wordmark — decorative texture only. */}
      <div
        aria-hidden="true"
        className="border-teal/10 pointer-events-none absolute h-[36rem] w-[36rem] rounded-full border-[3rem]"
      />

      <div className="relative flex w-full max-w-[480px] flex-col items-center text-center">
        <Postmark size="lg" />

        <h1 className="font-display text-ink mt-8 text-4xl font-bold tracking-tight sm:text-5xl">
          MemoryLane
        </h1>
        <p className="text-ink-soft mt-3 text-base">
          Tap a place, walk back into the moment.
        </p>

        <div className="mt-10 flex w-full flex-col gap-3">
          <Link
            href="/create"
            className="bg-teal rounded-full px-6 py-3 text-center font-medium text-white shadow-sm transition hover:opacity-90"
          >
            Create an Album
          </Link>
          <Link
            href="/guest"
            className="border-teal text-teal rounded-full border px-6 py-3 text-center font-medium transition hover:bg-teal/5"
          >
            I&rsquo;m a Guest
          </Link>
        </div>
      </div>
    </main>
  );
}
