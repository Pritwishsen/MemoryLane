import type { DisplayMode } from "@/types/models";

/** Human names for display modes, shared by host screens and guest view. */
export const DISPLAY_MODE_NAME: Record<DisplayMode, string> = {
  grid: "Grid",
  slideshow: "Slideshow",
  contact: "Contact sheet",
  stack: "Stack",
  scrapbook: "Scrapbook",
  gallery: "Gallery",
};
