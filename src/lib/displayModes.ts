import type { DisplayMode } from "@/types/models";

/** Human names for display modes, shared by host screens and guest view.
 *  Key order is the order the page editor lists them in. */
export const DISPLAY_MODE_NAME: Record<DisplayMode, string> = {
  grid: "Grid",
  slideshow: "Slideshow",
  contact: "Contact sheet",
  stack: "Stack",
  scrapbook: "Scrapbook",
  gallery: "Gallery",
  filmstrip: "Filmstrip",
  polaroid: "Polaroid wall",
  reel: "Story reel",
  mosaic: "Mosaic",
  hero: "Hero + strip",
};

/** One-line description under each mode in the page editor. */
export const DISPLAY_MODE_HINT: Record<DisplayMode, string> = {
  grid: "Two columns, tap to enlarge",
  slideshow: "Auto-advances, tap sides to steer",
  contact: "Swipe sideways · best over 15 photos",
  stack: "One print at a time · best under 10",
  scrapbook: "Mixed sizes, taped down",
  gallery: "Big photo with a thumbnail rail",
  filmstrip: "One row, swipe sideways · for long trips",
  polaroid: "Tilted prints, a caption under each",
  reel: "Photos play in order beside your story",
  mosaic: "Tight, even rows for mixed portrait and landscape",
  hero: "One big cover photo, the rest in a row",
};

/** Modes that auto-advance and use the page's interval setting. */
export const TIMED_MODES: DisplayMode[] = ["slideshow", "reel"];

export const DISPLAY_MODES = Object.keys(DISPLAY_MODE_NAME) as DisplayMode[];

/** Layouts that suit a page with `count` photos (after keyword filter and
 *  random limit): few photos read best one at a time, a medium set in a
 *  browsable layout, many in a scrolling strip or dense rows. */
export function suggestedModes(count: number): DisplayMode[] {
  if (count <= 0) return [];
  if (count <= 9) return ["stack", "slideshow", "polaroid"];
  if (count <= 15) return ["grid", "gallery", "hero", "scrapbook"];
  return ["contact", "filmstrip", "mosaic"];
}
