"use client";

import Image from "next/image";
import type { DisplayPhoto } from "./PhotoGrid";

type PhotoLightboxProps = {
  photos: DisplayPhoto[];
  openIndex: number;
  onClose: () => void;
};

/** Extracted from PhotoGrid so contact/scrapbook can reuse the same
 *  tap-to-enlarge overlay instead of duplicating it. */
export default function PhotoLightbox({ photos, openIndex, onClose }: PhotoLightboxProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    >
      <div className="relative h-full w-full max-w-3xl">
        <Image
          src={photos[openIndex].url}
          alt={photos[openIndex].name}
          fill
          sizes="100vw"
          className="object-contain"
        />
      </div>
    </div>
  );
}
