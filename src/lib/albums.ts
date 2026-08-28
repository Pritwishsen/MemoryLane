import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebaseAdmin";
import { generateSlug } from "./slug";
import type { Album, Page } from "@/types/models";

function albumsCol() {
  return getAdminDb().collection("albums");
}

function pagesCol(albumId: string) {
  return albumsCol().doc(albumId).collection("pages");
}

export async function listAlbumsForUser(uid: string): Promise<Album[]> {
  // where(ownerUid) + orderBy(createdAt) together need a Firestore composite
  // index — sorting in memory instead avoids that setup step entirely, and
  // at personal-app scale (a handful of albums per host) this is negligible.
  const snap = await albumsCol().where("ownerUid", "==", uid).get();
  const albums = snap.docs.map((d) => d.data() as Album);
  return albums.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createAlbum(uid: string, title: string): Promise<Album> {
  const ref = albumsCol().doc();
  const album: Album = {
    id: ref.id,
    ownerUid: uid,
    title,
    createdAt: new Date().toISOString(),
    pageOrder: [],
  };
  await ref.set(album);
  return album;
}

/** Returns null if the album doesn't exist OR isn't owned by this uid — the
 *  caller treats both the same way (404), so ownership never leaks via a
 *  different status code than "not found". */
export async function getOwnedAlbum(
  albumId: string,
  uid: string
): Promise<Album | null> {
  const doc = await albumsCol().doc(albumId).get();
  if (!doc.exists) return null;
  const album = doc.data() as Album;
  if (album.ownerUid !== uid) return null;
  return album;
}

export async function listPages(albumId: string): Promise<Page[]> {
  const snap = await pagesCol(albumId).get();
  const byId = new Map(snap.docs.map((d) => [d.id, d.data() as Page]));
  return [...byId.values()];
}

export async function addPage(albumId: string, header: string): Promise<Page> {
  const ref = pagesCol(albumId).doc();
  const now = new Date().toISOString();
  const page: Page = {
    id: ref.id,
    albumId,
    nfcSlug: generateSlug(header),
    header,
    bodyText: "",
    locationName: "",
    lat: null,
    lng: null,
    driveFolderId: "",
    imageFilter: "all",
    tagKeyword: "",
    displayMode: "grid",
    createdAt: now,
    updatedAt: now,
  };

  const batch = getAdminDb().batch();
  batch.set(ref, page);
  batch.update(albumsCol().doc(albumId), {
    pageOrder: FieldValue.arrayUnion(ref.id),
  });
  await batch.commit();

  return page;
}

export async function deletePage(albumId: string, pageId: string): Promise<void> {
  const batch = getAdminDb().batch();
  batch.delete(pagesCol(albumId).doc(pageId));
  batch.update(albumsCol().doc(albumId), {
    pageOrder: FieldValue.arrayRemove(pageId),
  });
  await batch.commit();
}

export async function reorderPages(
  albumId: string,
  pageOrder: string[]
): Promise<void> {
  await albumsCol().doc(albumId).update({ pageOrder });
}

export async function renameAlbum(albumId: string, title: string): Promise<void> {
  await albumsCol().doc(albumId).update({ title });
}
