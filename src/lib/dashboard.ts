import { listPages } from "./albums";
import { driveImageUrl, firstImageThumbnail } from "./drive";
import { dedupeInvitesByEmail, listInvitesForAlbums } from "./invites";
import type { Album } from "@/types/models";

export type AlbumCard = {
  id: string;
  title: string;
  pageCount: number;
  guestEmails: string[];
  coverUrl: string | null;
};

/** Everything the "Your albums" grid needs, assembled server-side. Covers
 *  come from the first page (in album order) that has a Drive folder; any
 *  Drive failure (expired token, unshared folder) just means no cover —
 *  the card falls back to the striped placeholder rather than erroring. */
export async function buildAlbumCards(albums: Album[], accessToken: string | undefined): Promise<AlbumCard[]> {
  const invitesByAlbum = await listInvitesForAlbums(albums.map((a) => a.id));

  return Promise.all(
    albums.map(async (album) => {
      const guestEmails = dedupeInvitesByEmail(invitesByAlbum.get(album.id) ?? []).map((i) => i.guestEmail);
      let coverUrl: string | null = null;
      if (accessToken && album.pageOrder.length > 0) {
        try {
          const pages = await listPages(album.id);
          const byId = new Map(pages.map((p) => [p.id, p]));
          const first = album.pageOrder.map((id) => byId.get(id)).find((p) => p && p.driveFolderIds.length > 0);
          const thumb = first ? await firstImageThumbnail(accessToken, first.driveFolderIds) : null;
          coverUrl = thumb ? driveImageUrl(thumb, 640) : null;
        } catch {
          coverUrl = null;
        }
      }
      return { id: album.id, title: album.title, pageCount: album.pageOrder.length, guestEmails, coverUrl };
    })
  );
}
