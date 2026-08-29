"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { DisplayPhoto } from "./PhotoGrid";

type PhotoSlideshowProps = { photos: DisplayPhoto[]; intervalSec?: number };

export default function PhotoSlideshow({ photos, intervalSec = 4 }: PhotoSlideshowProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || photos.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, intervalSec * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, photos.length, intervalSec]);

  function goTo(next: number) {
    setPaused(true);
    setIndex(((next % photos.length) + photos.length) % photos.length);
  }

  const photo = photos[index];
  const isLoaded = loadedIds.has(photo.id);

  return (
    <div
      className={`relative aspect-[4/5] w-full overflow-hidden rounded-photo bg-black/5 ${
        isLoaded ? "" : "animate-pulse"
      }`}
    >
      <Image
        key={photo.id}
        src={photo.url}
        alt={photo.name}
        fill
        priority
        sizes="(max-width: 480px) 100vw, 480px"
        className="object-cover"
        onLoad={() => setLoadedIds((prev) => new Set(prev).add(photo.id))}
      />

      <button
        type="button"
        aria-label="Previous photo"
        onClick={() => goTo(index - 1)}
        className="absolute inset-y-0 left-0 w-1/3"
      />
      <button
        type="button"
        aria-label="Next photo"
        onClick={() => goTo(index + 1)}
        className="absolute inset-y-0 right-0 w-1/3"
      />

      {photos.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {photos.map((p, i) => (
            <span
              key={p.id}
              className={`h-1.5 w-1.5 rounded-full ${
                i === index ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
