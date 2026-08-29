"use client";

import { useState } from "react";
import Image from "next/image";

export type DisplayPhoto = { id: string; name: string; url: string };

type PhotoGridProps = { photos: DisplayPhoto[] };

export default function PhotoGrid({ photos }: PhotoGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={`rounded-photo relative aspect-square overflow-hidden bg-black/5 ${
              loadedIds.has(photo.id) ? "" : "animate-pulse"
            }`}
          >
            <Image
              src={photo.url}
              alt={photo.name}
              fill
              sizes="(max-width: 480px) 50vw, 240px"
              className="object-cover"
              onLoad={() => setLoadedIds((prev) => new Set(prev).add(photo.id))}
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenIndex(null)}
          onKeyDown={(e) => e.key === "Escape" && setOpenIndex(null)}
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
      )}
    </>
  );
}
