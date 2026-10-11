"use client";

import { useState } from "react";
import Image from "next/image";
import type { DisplayPhoto } from "./PhotoGrid";

/** Stories-style reel: photos play in order with a segmented progress bar.
 *  The active segment's fill is a CSS animation lasting `intervalSec`; its
 *  animationend advances to the next photo, and pausing just pauses the
 *  animation, so there is no timer to drift or leak. Tap the middle to
 *  pause/resume, the sides to step back or forward. */
export default function PhotoStoryReel({ photos, intervalSec = 4 }: { photos: DisplayPhoto[]; intervalSec?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = photos.length;
  const photo = photos[index];

  const go = (next: number) => setIndex(((next % count) + count) % count);

  return (
    <div>
      <div className="rounded-photo relative aspect-[4/5] w-full overflow-hidden bg-black/5">
        <Image
          key={photo.id}
          src={photo.url}
          alt={photo.name}
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover"
        />

        <div className="absolute inset-x-3 top-3 flex gap-1.5" aria-hidden="true">
          {photos.map((p, i) => (
            <span key={p.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/40">
              {i < index && <span className="block h-full w-full bg-white" />}
              {i === index && (
                <span
                  key={`${p.id}-${index}`}
                  className="reel-fill block h-full bg-white"
                  style={{
                    animationDuration: `${intervalSec}s`,
                    animationPlayState: paused || count <= 1 ? "paused" : "running",
                  }}
                  onAnimationEnd={() => go(index + 1)}
                />
              )}
            </span>
          ))}
        </div>

        <button type="button" aria-label="Previous photo" onClick={() => go(index - 1)} className="absolute inset-y-0 left-0 w-1/4" />
        <button
          type="button"
          aria-label={paused ? "Play" : "Pause"}
          onClick={() => setPaused((v) => !v)}
          className="absolute inset-y-0 left-1/4 w-1/2"
        />
        <button type="button" aria-label="Next photo" onClick={() => go(index + 1)} className="absolute inset-y-0 right-0 w-1/4" />

        {paused && (
          <span className="font-meta-label pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white">
            Paused
          </span>
        )}
      </div>
      <p className="font-meta-label text-ink-soft mt-3 text-[11px]">
        {count > 1 ? "Plays automatically · tap to pause" : "1 photo"}
      </p>
    </div>
  );
}
