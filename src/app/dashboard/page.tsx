import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { listAlbumsForUser } from "@/lib/albums";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/create");

  const albums = await listAlbumsForUser(session.uid);

  return (
    <DashboardClient
      albums={albums}
      userName={session.user?.name ?? null}
      userImage={session.user?.image ?? null}
    />
  );
}
