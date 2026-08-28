import SignInScreen from "@/components/SignInScreen";

// TODO(Phase 2): once NextAuth is wired up, this route should check the
// session server-side and redirect straight to /dashboard if already signed
// in, per the spec's routing table ("Redirects to Google sign-in if not
// authenticated, then to album dashboard").
export default function CreatePage() {
  return <SignInScreen variant="host" />;
}
