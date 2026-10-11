"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoLightbox from "./PhotoLightbox";
import type { DisplayPhoto } from "./PhotoGrid";

const ROW_HEIGHT = 110;

/** Justified rows (Flickr/Google Photos style) in pure CSS, so it renders
 *  identically on server and client with no measuring: each tile grows in
 *  proportion to its aspect ratio from a basis of ROW_HEIGHT × ratio, and a
 *  padding-bottom box keeps its shape as it stretches. A trailing spacer
 *  with a large flex-grow stops the last row from ballooning. Photos with
 *  unknown size are treated as 4:3. Tap to open full screen. */
export default function PhotoMosaic({ photos }: { photos: DisplayPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {photos.map((photo, i) => {
          // Clamp extreme panoramas/slivers so one photo can't take a row.
          const ratio = Math.min(Math.max(photo.aspect ?? 4 / 3, 0.5), 2.4);
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={`Open ${photo.name}`}
              className="relative overflow-hidden rounded-[3px] bg-black/5"
              style={{ flexGrow: ratio, flexBasis: ratio * ROW_HEIGHT }}
            >
              <span className="block" style={{ paddingBottom: `${100 / ratio}%` }} />
              <Image src={photo.url} alt={photo.name} fill sizes="(max-width: 480px) 60vw, 300px" className="object-cover" />
            </button>
          );
        })}
        <span aria-hidden="true" style={{ flexGrow: 10, flexBasis: 0 }} />
      </div>
      <p className="font-meta-label text-ink-soft mt-3 text-[11px]">Tap a photo to open full screen</p>

      {openIndex !== null && (
        <PhotoLightbox photos={photos} openIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}
