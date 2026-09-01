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

/** Top-level nfcSlug -> {albumId, pageId} lookup, kept in sync with the
 *  pages subcollection. A guest scanning a tag only has the slug, and pages
 *  live under albums/{albumId}/pages — a collection-group query on nfcSlug
 *  would need a manually-created Firestore index (same class of setup step
 *  we avoided for listAlbumsForUser), so this small side table trades a
 *  little write-time bookkeeping for a plain doc-id lookup instead. */
function slugsCol() {
  return getAdminDb().collection("slugs");
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
    introText: "",
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

/** No ownership check — for guest-facing routes (`/guest/[albumId]/summary`)
 *  where the viewer is never the owner. Real access control for what a guest
 *  can actually see lives in the per-page Drive folder check (Feature 6),
 *  not here — an album's title/page list isn't sensitive on its own. */
export async function getAlbum(albumId: string): Promise<Album | null> {
  const doc = await albumsCol().doc(albumId).get();
  return doc.exists ? (doc.data() as Album) : null;
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
    // No slug yet — every new page starts life titled "Untitled", and a
    // slug generated from that would always read "untitled-xxxxx" even
    // after the host renames it. Left empty until the host's first real
    // Save (see assignSlugIfMissing), so it's generated from an actual
    // header instead. The NFC link UI only appears once this is set.
    nfcSlug: "",
    header,
    bodyText: "",
    place: "",
    country: "",
    lat: null,
    lng: null,
    driveFolderIds: [],
    imageFilter: "all",
    tagKeyword: "",
    randomizeAll: false,
    randomLimit: 20,
    displayMode: "grid",
    slideshowIntervalSec: 4,
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

/** Generates and assigns a slug the first time a page is really saved (see
 *  addPage's comment for why creation time itself is too early) — a no-op
 *  once the page already has one, since a slug must never change after a
 *  physical NFC tag could have been written with it. */
export async function assignSlugIfMissing(
  albumId: string,
  pageId: string,
  existingSlug: string,
  header: string
): Promise<string> {
  if (existingSlug) return existingSlug;

  const nfcSlug = generateSlug(header);
  const batch = getAdminDb().batch();
  batch.update(pagesCol(albumId).doc(pageId), { nfcSlug });
  batch.set(slugsCol().doc(nfcSlug), { albumId, pageId });
  await batch.commit();
  return nfcSlug;
}

export async function getPage(albumId: string, pageId: string): Promise<Page | null> {
  const doc = await pagesCol(albumId).doc(pageId).get();
  return doc.exists ? (doc.data() as Page) : null;
}

export async function updatePage(
  albumId: string,
  pageId: string,
  fields: Partial<
    Pick<
      Page,
      | "header"
      | "bodyText"
      | "place"
      | "country"
      | "lat"
      | "lng"
      | "driveFolderIds"
      | "imageFilter"
      | "tagKeyword"
      | "randomizeAll"
      | "randomLimit"
      | "displayMode"
      | "slideshowIntervalSec"
    >
  >
): Promise<void> {
  await pagesCol(albumId)
    .doc(pageId)
    .update({ ...fields, updatedAt: new Date().toISOString() });
}

/** O(1) lookup for `/p/[nfcSlug]` — see slugsCol() above for why this isn't
 *  a collection-group query. */
export async function getPageBySlug(
  nfcSlug: string
): Promise<{ page: Page; album: Album } | null> {
  const slugDoc = await slugsCol().doc(nfcSlug).get();
  if (!slugDoc.exists) return null;

  const { albumId, pageId } = slugDoc.data() as { albumId: string; pageId: string };
  const [pageDoc, albumDoc] = await Promise.all([
    pagesCol(albumId).doc(pageId).get(),
    albumsCol().doc(albumId).get(),
  ]);
  if (!pageDoc.exists || !albumDoc.exists) return null;

  return { page: pageDoc.data() as Page, album: albumDoc.data() as Album };
}

export async function deletePage(albumId: string, pageId: string): Promise<void> {
  const pageRef = pagesCol(albumId).doc(pageId);
  const pageDoc = await pageRef.get();

  const batch = getAdminDb().batch();
  batch.delete(pageRef);
  if (pageDoc.exists) {
    // Empty until the first Save (see addPage) — Firestore rejects an
    // empty-string doc id outright, so this must stay guarded.
    const { nfcSlug } = pageDoc.data() as Page;
    if (nfcSlug) batch.delete(slugsCol().doc(nfcSlug));
  }
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

export async function setAlbumIntroText(albumId: string, introText: string): Promise<void> {
  await albumsCol().doc(albumId).update({ introText });
}

/** Firestore doesn't cascade-delete subcollections — the pages under an
 *  album have to be deleted explicitly or they'd become permanently
 *  unreachable (still billed, never shown) orphans. */
export async function deleteAlbum(albumId: string): Promise<void> {
  const pagesSnap = await pagesCol(albumId).get();
  const batch = getAdminDb().batch();
  pagesSnap.docs.forEach((doc) => {
    batch.delete(doc.ref);
    const { nfcSlug } = doc.data() as Page;
    if (nfcSlug) batch.delete(slugsCol().doc(nfcSlug));
  });
  batch.delete(albumsCol().doc(albumId));
  await batch.commit();
}
