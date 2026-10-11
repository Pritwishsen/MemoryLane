"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoLightbox from "./PhotoLightbox";
import type { DisplayPhoto } from "./PhotoGrid";

// Fixed tilt cycle (not random) so the wall looks the same on every visit
// and server and client render identically.
const TILTS = [-4, 3, 2, -3, 1.5, -2];

/** File name without its extension, for the handwritten-style caption. */
function caption(name: string): string {
  return name.replace(/\.[a-z0-9]{2,5}$/i, "");
}

/** Two columns of tilted white-framed prints, each captioned with its file
 *  name. Tap a print to enlarge. */
export default function PhotoPolaroidWall({ photos }: { photos: DisplayPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-[18px] py-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={`Open ${photo.name}`}
            className="rounded-[3px] bg-white px-2 pb-[34px] pt-2 text-left shadow-[0_2px_8px_rgba(34,32,27,0.22)] transition-transform hover:rotate-0"
            style={{ transform: `rotate(${TILTS[i % TILTS.length]}deg)` }}
          >
            <span className="relative block aspect-[4/5] overflow-hidden rounded-[2px] bg-black/5">
              <Image src={photo.url} alt={photo.name} fill sizes="(max-width: 480px) 45vw, 220px" className="object-cover" />
            </span>
            <span className="font-display text-ink mt-2 block truncate text-center text-xs">{caption(photo.name)}</span>
          </button>
        ))}
      </div>
      <p className="font-meta-label text-ink-soft mt-3 text-[11px]">Tap a print to enlarge</p>

      {openIndex !== null && (
        <PhotoLightbox photos={photos} openIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}
