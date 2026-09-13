"use client";

import { useState } from "react";
import Image from "next/image";
import type { DisplayPhoto } from "./PhotoGrid";

type PhotoStackProps = { photos: DisplayPhoto[]; place?: string };

const LAYERS = [
  { rotate: 1.5, left: 0, top: 0, background: "#ffffff", boxShadow: "0 8px 20px rgba(34,32,27,.24)" },
  { rotate: -3, left: 6, top: 8, background: "#F1EAE0", boxShadow: "0 3px 8px rgba(34,32,27,.18)" },
  { rotate: 5, left: 14, top: 14, background: "#EFE8DD", boxShadow: "0 2px 6px rgba(34,32,27,.16)" },
] as const;

/** Shoebox stack: only ever renders up to 3 layers (front + 2 peeking
 *  behind), advancing by animating the front card off and promoting the
 *  rest — never a real DOM list of every photo. */
export default function PhotoStack({ photos, place }: PhotoStackProps) {
  const [index, setIndex] = useState(0);
  const [exiting, setExiting] = useState(false);
  const label = place ? place.toUpperCase() : null;

  function advance() {
    if (exiting || photos.length <= 1) return;
    setExiting(true);
    setTimeout(() => {
      setIndex((i) => (i + 1) % photos.length);
      setExiting(false);
    }, 260);
  }

  const visible = LAYERS.map((_, layer) => photos[(index + layer) % photos.length]).filter(
    (photo, layer, arr) => photo && arr.findIndex((p) => p?.id === photo.id) === layer
  );

  return (
    <div>
      <div className="relative" style={{ height: 330 }}>
        {visible.map((photo, layer) => {
          const style = LAYERS[layer];
          const isFront = layer === 0;
          return (
            <div
              key={photo.id}
              role={isFront ? "button" : undefined}
              tabIndex={isFront ? 0 : undefined}
              onClick={isFront ? advance : undefined}
              onKeyDown={isFront ? (e) => e.key === "Enter" && advance() : undefined}
              className="absolute w-[270px] overflow-hidden rounded-[2px] px-2 pt-2 pb-[30px]"
              style={{
                left: style.left,
                top: style.top,
                background: style.background,
                boxShadow: style.boxShadow,
                transform:
                  isFront && exiting
                    ? "translateX(-120%) rotate(-14deg)"
                    : `rotate(${style.rotate}deg)`,
                transition: isFront ? "transform 260ms ease-in" : undefined,
                zIndex: LAYERS.length - layer,
                cursor: isFront ? "pointer" : "default",
              }}
            >
              <div className="relative h-[210px] w-full overflow-hidden">
                <Image src={photo.url} alt={photo.name} fill sizes="270px" className="object-cover" />
              </div>
              {isFront && (
                <p
                  className="mt-2 text-center text-[10px]"
                  style={{
                    fontFamily: "var(--font-meta)",
                    letterSpacing: "0.06em",
                    color: "var(--color-ink-soft)",
                  }}
                >
                  {[label, `${String(index + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p
        className="font-meta-label mt-3 text-center text-[9px]"
        style={{ color: "var(--color-brass)", letterSpacing: "0.12em" }}
      >
        Swipe to deal the next print
      </p>
    </div>
  );
}
