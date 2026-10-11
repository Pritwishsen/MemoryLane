"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoLightbox from "./PhotoLightbox";
import type { DisplayPhoto } from "./PhotoGrid";

/** One row of tall prints that swipes sideways with snap — built for long
 *  trips with many photos. Each frame is 62% of the column so the next one
 *  peeks in and invites a swipe. Tap to enlarge. */
export default function PhotoFilmstrip({ photos }: { photos: DisplayPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div
        className="-mx-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8"
        style={{ scrollSnapType: "x mandatory", scrollPaddingInline: 20 }}
      >
        <div className="flex gap-2.5">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={`Open ${photo.name}`}
              style={{ scrollSnapAlign: "start" }}
              className="rounded-photo relative aspect-[3/4] w-[62%] shrink-0 overflow-hidden bg-black/5"
            >
              <Image src={photo.url} alt={photo.name} fill sizes="300px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>
      <p className="font-meta-label text-ink-soft mt-2 text-[11px]">Swipe sideways</p>

      {openIndex !== null && (
        <PhotoLightbox photos={photos} openIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}
