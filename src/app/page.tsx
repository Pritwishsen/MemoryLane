import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { listAlbumsForUser } from "@/lib/albums";
import { listInvitesForGuest } from "@/lib/invites";
import RingStamp from "@/components/RingStamp";
import LoginButton from "@/components/LoginButton";
import { AVATAR_TINTS } from "@/components/ui/styles";

const STEPS = [
  {
    n: "01",
    title: "Connect your photos",
    body: "Pick a Google Drive folder for each place. Show every photo, a random set, or only those with a keyword.",
  },
  {
    n: "02",
    title: "Build the album",
    body: "Give each place a title and a story, then put the places in order. Each one gets its own postmark.",
  },
  {
    n: "03",
    title: "Share it",
    body: "Invite people by email. They sign in with Google and open the album on a map, one place at a time.",
  },
];

/** A drawn stand-in "photo" for the hero prints. Real photos only ever come
 *  from the host's Drive, so the landing art is illustration, not stock. */
function Scene({ variant }: { variant: "hills" | "lake" }) {
  const hills = variant === "hills";
  return (
    <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" className="block h-full w-full rounded-[2px]">
      <rect width="100" height="120" fill={hills ? "#E9D9BC" : "#DCE3DC"} />
      <circle cx={hills ? 70 : 28} cy="34" r="12" fill={hills ? "#E2A85A" : "#F1E6CF"} />
      {hills ? (
        <>
          <path d="M0 86 Q25 62 50 80 T100 72 V120 H0Z" fill="#B88A55" />
          <path d="M0 100 Q30 84 60 98 T100 92 V120 H0Z" fill="#8A6A2E" />
          <path d="M20 70 v-14 h6 v-6 h4 v6 h6 v14z" fill="#A6402C" opacity=".8" />
        </>
      ) : (
        <>
          <path d="M0 70 Q30 56 55 66 T100 62 V80 H0Z" fill="#7F9A8E" />
          <rect y="80" width="100" height="40" fill="#5E8580" />
          <path d="M0 88 H100 M10 96 H90 M20 104 H80" stroke="#DCE3DC" strokeWidth="1" opacity=".6" />
        </>
      )}
    </svg>
  );
}

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    // One Google sign-in for hosts and guests, so route by what the account
    // has: invite-only accounts go to the guest side, everyone else
    // (including brand-new accounts) to "Your albums".
    const [owned, invites] = await Promise.all([
      listAlbumsForUser(session.uid),
      session.user?.email ? listInvitesForGuest(session.user.email) : Promise.resolve([]),
    ]);
    redirect(owned.length === 0 && invites.length > 0 ? "/guest" : "/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center px-5 pb-10 pt-6 sm:px-10 sm:pt-10">
      <div className="flex w-full max-w-[1080px] flex-col gap-8 sm:gap-14">
        <span className="font-display text-ink text-xl font-bold">MemoryLane</span>

        <div className="flex flex-wrap items-center gap-8 sm:gap-16">
          <div className="min-w-0 flex-[1_1_340px]">
            <span className="font-meta-label text-gold text-[11px] tracking-[0.14em]">
              Photo albums for places you&rsquo;ve been
            </span>
            <h1 className="font-display text-ink mt-3.5 text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[48px] lg:text-[60px]">
              Turn your Drive photos into albums worth sharing.
            </h1>
            <p className="text-ink-soft mt-[18px] max-w-[460px] text-pretty text-[17px] leading-relaxed">
              Pick a Google Drive folder for each place, add a story, and arrange the places into an
              album. Invite family and friends, and they sign in to see it, page by page, on a map of
              your trip.
            </p>
            <div className="mt-7 max-w-[340px]">
              <LoginButton callbackUrl="/" host />
            </div>
            <p className="text-ink-soft mt-3.5 max-w-[340px] text-sm leading-normal">
              Invited to an album? Sign in with the Google account your host invited.{" "}
              <Link href="/guest" className="text-teal font-medium underline">
                See my albums
              </Link>
            </p>
            <div className="border-ink/10 mt-5 flex max-w-[340px] items-start gap-2.5 border-t pt-4">
              <span className="border-teal text-teal flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-semibold">
                i
              </span>
              <p className="text-ink-soft text-[13px] leading-normal">
                Your photos stay in your Google Drive. MemoryLane only reads the folders you choose to
                share.
              </p>
            </div>
          </div>

          <div aria-hidden="true" className="flex min-w-0 flex-[1_1_320px] justify-center">
            <div className="relative h-[340px] w-[360px] max-w-full">
              <div className="absolute left-2 top-7 h-60 w-[200px] -rotate-6 rounded-md bg-white px-2.5 pb-9 pt-2.5 shadow-[0_8px_24px_rgba(34,32,27,0.16)]">
                <Scene variant="hills" />
                <span className="font-display absolute bottom-2.5 left-3 text-sm font-semibold">
                  Brass Elephant
                </span>
              </div>
              <div className="absolute right-1.5 top-0 h-[200px] w-[170px] rotate-[5deg] rounded-md bg-white px-2.5 pb-8 pt-2.5 shadow-[0_8px_24px_rgba(34,32,27,0.16)]">
                <Scene variant="lake" />
                <span className="font-meta-label text-ink-soft absolute bottom-2 left-3 text-[11px]">
                  Udaipur, India
                </span>
              </div>
              <div className="absolute left-[150px] top-[176px]">
                <RingStamp label="JAIPUR · INDIA" id="hero" size={112} fontSize={11} letterSpacing={1.4} tilt={-8} />
              </div>
              <div className="border-ink/10 absolute bottom-3 right-0 w-[150px] rounded-[10px] border bg-white px-3 py-2.5 shadow-[0_6px_16px_rgba(34,32,27,0.12)]">
                <div className="font-meta-label text-ink-soft text-[11px]">Shared with</div>
                <div className="mt-2 flex">
                  {["A", "R", "M"].map((l, i) => (
                    <span
                      key={l}
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white text-[11px]"
                      style={{ marginLeft: i ? -8 : 0, background: AVATAR_TINTS[i] }}
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-ink/10 border-t pt-7">
          <span className="font-meta-label text-ink-soft text-[11px] tracking-[0.14em]">How it works</span>
          <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
            {STEPS.map((st) => (
              <div key={st.n}>
                <span className="font-meta text-gold text-[13px] font-bold">{st.n}</span>
                <h3 className="font-display text-ink mt-1.5 text-[19px] font-semibold">{st.title}</h3>
                <p className="text-ink-soft mt-1.5 text-pretty text-sm leading-relaxed">{st.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
