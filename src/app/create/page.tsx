import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import SignInScreen from "@/components/SignInScreen";

export default async function CreatePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return <SignInScreen variant="host" />;
}
