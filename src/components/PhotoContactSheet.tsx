"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoLightbox from "./PhotoLightbox";
import type { DisplayPhoto } from "./PhotoGrid";

type PhotoContactSheetProps = { photos: DisplayPhoto[] };

const SPROCKET_ROW_STYLE = {
  height: 6,
  backgroundImage:
    "repeating-linear-gradient(to right, rgba(243,237,228,.35) 0 9px, transparent 9px 13px)",
  backgroundPosition: "12px 0",
};

/** Full-bleed film strip — the classic "escape the column" trick (relative
 *  left-1/2 + negative 50vw margin + w-screen) so it reaches both screen
 *  edges regardless of the 480px guest column it sits inside. */
export default function PhotoContactSheet({ photos }: PhotoContactSheetProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div
      className="relative left-1/2 right-1/2 w-screen -mx-[50vw] py-2"
      style={{ background: "var(--color-ink)" }}
    >
      <div style={SPROCKET_ROW_STYLE} />
      <div className="overflow-x-auto" style={{ scrollSnapType: "x mandatory" }}>
        <div className="flex gap-1.5 px-3 py-1.5">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              style={{ scrollSnapAlign: "start" }}
              className="relative h-[168px] w-[225px] shrink-0 overflow-hidden bg-black/20"
            >
              <Image src={photo.url} alt={photo.name} fill sizes="225px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>
      <div style={SPROCKET_ROW_STYLE} />

      {openIndex !== null && (
        <PhotoLightbox photos={photos} openIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </div>
  );
}
