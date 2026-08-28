export type Album = {
  id: string;
  ownerUid: string;
  title: string;
  createdAt: string;
  /** Page IDs, in display order. Called `pages: []` in the spec — renamed
   *  here to avoid colliding with the `pages` subcollection name. */
  pageOrder: string[];
};

export type ImageFilter = "all" | "starred" | "tagged";
export type DisplayMode = "grid" | "slideshow";

export type Page = {
  id: string;
  albumId: string;
  nfcSlug: string;
  header: string;
  bodyText: string;
  locationName: string;
  lat: number | null;
  lng: number | null;
  driveFolderId: string;
  imageFilter: ImageFilter;
  tagKeyword: string;
  displayMode: DisplayMode;
  createdAt: string;
  updatedAt: string;
};
