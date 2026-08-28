import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import SignInScreen from "@/components/SignInScreen";

// TODO(Phase 4): once an invite/NFC link carries an albumId, a signed-in
// guest with one in context should land on /guest/[albumId]/summary instead
// of this generic placeholder.
export default async function GuestPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    return (
      <main className="flex min-h-full flex-1 flex-col items-center justify-center px-5 py-8 text-center sm:px-8">
        <div className="w-full max-w-[480px]">
          <h1 className="font-display text-ink text-2xl font-semibold">
            You&rsquo;re signed in
          </h1>
          <p className="text-ink-soft mt-3 text-sm leading-relaxed">
            Tap an NFC tag or open the invite link your host sent you to see
            an album.
          </p>
        </div>
      </main>
    );
  }

  return <SignInScreen variant="guest" />;
}
