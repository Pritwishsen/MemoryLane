"use client";

import { useState } from "react";
import Image from "next/image";
import type { DisplayPhoto } from "./PhotoGrid";

type PhotoGalleryProps = { photos: DisplayPhoto[] };

const RAIL_LIMIT = 5;

/** Hero + rail — the only mode a guest can jump to a specific photo in.
 *  Auto-advance stays off: GUEST_SCREENS.md describes it as "off by
 *  default, uses slideshowIntervalSec when on" but specs no guest-facing
 *  control to turn it on, so there's nothing to wire up in this pass.
 *
 *  The rail shows a RAIL_LIMIT-wide window, not just the first five photos —
 *  the +n chip on either end pages the window so every photo stays reachable
 *  (the spec's "+7 collapses overflow" note only covers the visual size of
 *  the chip, not clickability; without paging, photos past index 4 would be
 *  permanently unreachable). */
export default function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [active, setActive] = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const hero = photos[active];
  const rail = photos.slice(windowStart, windowStart + RAIL_LIMIT);
  const hiddenBefore = windowStart;
  const hiddenAfter = photos.length - (windowStart + rail.length);

  const goToPage = (newStart: number) => {
    const clamped = Math.max(0, Math.min(newStart, Math.max(photos.length - RAIL_LIMIT, 0)));
    setWindowStart(clamped);
    setActive(clamped);
  };

  return (
    <div>
      <div className="relative w-full overflow-hidden rounded-[4px]" style={{ height: 240 }}>
        <Image
          key={hero.id}
          src={hero.url}
          alt={hero.name}
          fill
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover"
        />
      </div>

      <div className="mt-2.5 flex" style={{ gap: 7 }}>
        {hiddenBefore > 0 && (
          <button
            type="button"
            onClick={() => goToPage(windowStart - RAIL_LIMIT)}
            aria-label={`Show ${hiddenBefore} earlier photos`}
            className="font-meta-label flex shrink-0 items-center justify-center rounded-[3px] text-[9px]"
            style={{ width: 30, height: 54, background: "#E7DFCC", color: "var(--color-ink-soft)" }}
          >
            +{hiddenBefore}
          </button>
        )}
        {rail.map((photo, i) => {
          const index = windowStart + i;
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActive(index)}
              className="relative h-[54px] min-w-0 overflow-hidden rounded-[3px]"
              style={{
                flex: "1 1 54px",
                maxWidth: 54,
                opacity: index === active ? 1 : 0.65,
                outline: index === active ? "2px solid var(--color-brass)" : undefined,
                outlineOffset: index === active ? 1 : undefined,
              }}
            >
              <Image src={photo.url} alt={photo.name} fill sizes="54px" className="object-cover" />
            </button>
          );
        })}
        {hiddenAfter > 0 && (
          <button
            type="button"
            onClick={() => goToPage(windowStart + RAIL_LIMIT)}
            aria-label={`Show ${hiddenAfter} more photos`}
            className="font-meta-label flex shrink-0 items-center justify-center rounded-[3px] text-[9px]"
            style={{ width: 30, height: 54, background: "#E7DFCC", color: "var(--color-ink-soft)" }}
          >
            +{hiddenAfter}
          </button>
        )}
      </div>
    </div>
  );
}
