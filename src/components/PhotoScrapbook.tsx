"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoLightbox from "./PhotoLightbox";
import type { DisplayPhoto } from "./PhotoGrid";

type PhotoScrapbookProps = { photos: DisplayPhoto[] };

/** Deterministic pseudo-random tilt from index — never Math.random(), so the
 *  page looks identical on every visit (per GUEST_SCREENS.md). */
function tiltForIndex(i: number, spread: number, offset: number): number {
  return (((i * 37 + offset) % 51) / 50) * spread - spread / 2;
}

export default function PhotoScrapbook({ photos }: PhotoScrapbookProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  let smallCount = 0;

  return (
    <>
      <div className="grid grid-cols-2" style={{ gap: 14 }}>
        {photos.map((photo, i) => {
          const isWide = i % 5 === 0;
          const secondColumn = !isWide && smallCount % 2 === 1;
          if (!isWide) smallCount++;

          const tilt = tiltForIndex(i, 5, 0);
          const tapeTilt = tiltForIndex(i, 4, 17) + 4; // 2..6deg
          const tapeWidth = isWide ? 54 : 40;
          const tapeHeight = isWide ? 16 : 14;

          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="relative rounded-[2px] bg-white text-left"
              style={{
                gridColumn: isWide ? "1 / -1" : undefined,
                marginTop: secondColumn ? 12 : 0,
                padding: isWide ? "7px 7px 22px" : "6px 6px 18px",
                boxShadow: "0 3px 9px rgba(34,32,27,.18)",
                transform: `rotate(${tilt}deg)`,
              }}
            >
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: isWide ? "2 / 1" : "1 / 1" }}
              >
                <Image
                  src={photo.url}
                  alt={photo.name}
                  fill
                  sizes={isWide ? "480px" : "240px"}
                  className="object-cover"
                />
              </div>
              <span
                aria-hidden
                className="absolute"
                style={{
                  left: "50%",
                  top: -8,
                  width: tapeWidth,
                  height: tapeHeight,
                  background: "rgba(181,138,70,.34)",
                  transform: `translateX(-50%) rotate(${tapeTilt}deg)`,
                }}
              />
            </button>
          );
        })}
      </div>

      {openIndex !== null && (
        <PhotoLightbox photos={photos} openIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}
