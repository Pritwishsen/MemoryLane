import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { listAlbumsForUser } from "@/lib/albums";
import { buildAlbumCards } from "@/lib/dashboard";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/create");

  const albums = await listAlbumsForUser(session.uid);
  // A failed token refresh leaves a stale accessToken on the session; skip
  // Drive entirely then rather than firing a dozen doomed requests.
  const token = session.error ? undefined : session.accessToken;
  const cards = await buildAlbumCards(session.uid, albums, token);

  return (
    <DashboardClient
      albums={cards}
      userName={session.user?.name ?? null}
      userImage={session.user?.image ?? null}
      userEmail={session.user?.email ?? null}
    />
  );
}
