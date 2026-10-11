"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoLightbox from "./PhotoLightbox";
import type { DisplayPhoto } from "./PhotoGrid";

/** One big cover photo (the first) with the rest four to a row below.
 *  Tap any photo to enlarge. */
export default function PhotoHeroStrip({ photos }: { photos: DisplayPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [cover, ...rest] = photos;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenIndex(0)}
        aria-label={`Open ${cover.name}`}
        className="rounded-photo relative block aspect-[16/10] w-full overflow-hidden bg-black/5"
      >
        <Image src={cover.url} alt={cover.name} fill priority sizes="(max-width: 480px) 100vw, 480px" className="object-cover" />
      </button>
      {rest.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {rest.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpenIndex(i + 1)}
              aria-label={`Open ${photo.name}`}
              className="relative aspect-square overflow-hidden rounded-[3px] bg-black/5"
            >
              <Image src={photo.url} alt={photo.name} fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="font-meta-label text-ink-soft mt-3 text-[11px]">Tap any photo to enlarge</p>

      {openIndex !== null && (
        <PhotoLightbox photos={photos} openIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}
