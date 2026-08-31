export type Album = {
  id: string;
  ownerUid: string;
  title: string;
  createdAt: string;
  /** Page IDs, in display order. Called `pages: []` in the spec — renamed
   *  here to avoid colliding with the `pages` subcollection name. */
  pageOrder: string[];
};

/** No "starred" option — Drive's starred flag is per-viewing-account, not a
 *  shared file property, so it can never reflect the host's curation to a
 *  guest (a guest's own starred list is separate and almost always empty).
 *  "tagged" (matching each file's description) is the equivalent that
 *  actually works cross-account, since description is visible to anyone
 *  with read access to the file. */
export type ImageFilter = "all" | "tagged";
export type DisplayMode = "grid" | "slideshow";

export type Page = {
  id: string;
  albumId: string;
  nfcSlug: string;
  header: string;
  bodyText: string;
  place: string;
  country: string;
  lat: number | null;
  lng: number | null;
  /** Photos are pooled from every folder here (dedup'd by file id) — a page
   *  isn't limited to a single Drive folder. */
  driveFolderIds: string[];
  imageFilter: ImageFilter;
  tagKeyword: string;
  /** Only meaningful when imageFilter === "all" — instead of always showing
   *  every photo in the folder, pick a fresh random subset (size randomLimit)
   *  each time the page is viewed. */
  randomizeAll: boolean;
  randomLimit: number;
  displayMode: DisplayMode;
  /** Slideshow auto-advance delay, in seconds. Only meaningful when
   *  displayMode === "slideshow". */
  slideshowIntervalSec: number;
  createdAt: string;
  updatedAt: string;
};

export type Invite = {
  id: string;
  albumId: string;
  guestEmail: string;
  note: string;
  invitedAt: string;
  /** "opened" is set when the guest actually visits the linked summary page
   *  (via an `invite` id in that URL) — informational only for the host,
   *  never an access gate (Feature 6's Drive-sharing check is the only
   *  real gate). */
  status: "sent" | "opened";
};
