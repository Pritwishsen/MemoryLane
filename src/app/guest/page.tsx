import SignInScreen from "@/components/SignInScreen";

// TODO(Phase 4): once guest access control exists, this is the generic guest
// entry point (as opposed to /p/[nfcSlug], which is where a scanned tag
// actually lands).
export default function GuestPage() {
  return <SignInScreen variant="guest" />;
}
