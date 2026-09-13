"use client";

import { useState } from "react";
import Image from "next/image";
import type { DisplayPhoto } from "./PhotoGrid";

type PhotoGalleryProps = { photos: DisplayPhoto[] };

const RAIL_LIMIT = 5;

/** Hero + rail — the only mode a guest can jump to a specific photo in.
 *  Auto-advance stays off: GUEST_SCREENS.md describes it as "off by
 *  default, uses slideshowIntervalSec when on" but specs no guest-facing
 *  control to turn it on, so there's nothing to wire up in this pass. */
export default function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [active, setActive] = useState(0);
  const hero = photos[active];
  const rail = photos.slice(0, RAIL_LIMIT);
  const overflow = photos.length - rail.length;

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
        {rail.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActive(i)}
            className="relative h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[3px]"
            style={{
              opacity: i === active ? 1 : 0.65,
              outline: i === active ? "2px solid var(--color-brass)" : undefined,
              outlineOffset: i === active ? 1 : undefined,
            }}
          >
            <Image src={photo.url} alt={photo.name} fill sizes="54px" className="object-cover" />
          </button>
        ))}
        {overflow > 0 && (
          <div
            className="font-meta-label flex shrink-0 items-center justify-center rounded-[3px] text-[9px]"
            style={{ width: 30, height: 54, background: "#E7DFCC", color: "var(--color-ink-soft)" }}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
