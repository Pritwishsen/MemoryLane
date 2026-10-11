/* eslint-disable @next/next/no-img-element -- tiny Drive thumbnails in a
   decorative preview; next/image adds nothing here. */
import type { CSSProperties } from "react";
import type { DisplayMode } from "@/types/models";

const BLOCK = "#C9C0A9";
const STRIPES = "repeating-linear-gradient(135deg,#ded5c0 0 6px,#d4cab3 6px 12px)";
const PRINT_SHADOW = "0 2px 8px rgba(34,32,27,.22)";

/** 54px-tall static mini layout per display mode for the editor's tiles.
 *  Approximate shapes, not literal miniatures of the real components. */
export function DisplayModeDiagram({ mode }: { mode: DisplayMode }) {
  const base = "h-[54px] w-full overflow-hidden rounded-[4px]";
  const paper = { background: "var(--color-paper)" };
  const b = (style: CSSProperties = {}, key?: string | number) => (
    <span key={key} className="block rounded-[2px]" style={{ background: BLOCK, ...style }} />
  );

  switch (mode) {
    case "grid":
      return (
        <div className={`${base} grid grid-cols-2 gap-1 p-1.5`} style={paper}>
          {[0, 1, 2, 3].map((i) => b({}, i))}
        </div>
      );
    case "slideshow":
    case "reel":
      return (
        <div className={`${base} flex flex-col items-center justify-center gap-1.5`} style={paper}>
          {b({ height: 32, width: mode === "reel" ? "60%" : "83%" })}
          {mode === "reel" ? (
            <span className="flex w-3/5 gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="h-[2px] flex-1 rounded-full" style={{ background: i < 2 ? "var(--color-teal)" : BLOCK }} />
              ))}
            </span>
          ) : (
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1 w-1 rounded-full" style={{ background: i === 0 ? "var(--color-teal)" : BLOCK }} />
              ))}
            </span>
          )}
        </div>
      );
    case "contact":
      return (
        <div className={`${base} flex items-center gap-1 px-1.5`} style={{ background: "var(--color-ink)" }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-8 w-3 shrink-0 rounded-[1px]" style={{ background: "rgba(243,237,228,.5)" }} />
          ))}
        </div>
      );
    case "filmstrip":
      return (
        <div className={`${base} flex items-center gap-1 pl-1.5`} style={paper}>
          {[0, 1, 2, 3].map((i) => b({ height: 38, width: 22, flexShrink: 0 }, i))}
        </div>
      );
    case "stack":
      return (
        <div className={`${base} relative`} style={paper}>
          {[
            [22, 10, "#E2DAC6", 6],
            [18, 8, "#D8CFB8", -3],
            [16, 6, BLOCK, 0],
          ].map(([left, top, bg, rot], i) => (
            <span
              key={i}
              className="absolute rounded-[2px]"
              style={{ left: left as number, top: top as number, width: 22, height: 34, background: bg as string, transform: `rotate(${rot}deg)` }}
            />
          ))}
        </div>
      );
    case "scrapbook":
      return (
        <div className={`${base} grid grid-cols-2 gap-1 p-1.5`} style={paper}>
          {b({ height: 12, gridColumn: "span 2" })}
          {b({ height: 20, transform: "rotate(-2deg)" })}
          {b({ height: 20, transform: "rotate(2deg)" })}
        </div>
      );
    case "polaroid":
      return (
        <div className={`${base} flex items-center justify-center gap-2`} style={paper}>
          {[-5, 4].map((rot) => (
            <span key={rot} className="bg-white px-[3px] pb-2 pt-[3px]" style={{ transform: `rotate(${rot}deg)`, boxShadow: "0 1px 3px rgba(34,32,27,.2)" }}>
              <span className="block h-6 w-5" style={{ background: BLOCK }} />
            </span>
          ))}
        </div>
      );
    case "mosaic":
      return (
        <div className={`${base} flex flex-col gap-[3px] p-1.5`} style={paper}>
          {[
            [3, 2, 2],
            [2, 3, 1.5],
          ].map((row, r) => (
            <span key={r} className="flex flex-1 gap-[3px]">
              {row.map((g, i) => b({ flexGrow: g, flexBasis: 0 }, i))}
            </span>
          ))}
        </div>
      );
    case "hero":
      return (
        <div className={`${base} flex flex-col gap-1 p-1.5`} style={paper}>
          {b({ height: 26, width: "100%" })}
          <span className="flex gap-1">{[0, 1, 2, 3].map((i) => b({ height: 10, flex: 1 }, i))}</span>
        </div>
      );
    default: // gallery
      return (
        <div className={`${base} flex flex-col gap-1 p-1.5`} style={paper}>
          {b({ height: 32, width: "100%" })}
          <span className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-2 w-2 rounded-[1px]" style={{ background: i === 0 ? "var(--color-brass)" : BLOCK }} />
            ))}
          </span>
        </div>
      );
  }
}

type Tile = { w: string; h: number; frame?: string; pad?: string; rot?: number; shadow?: string; flex?: string };

const t = (w: string, h: number, o: Partial<Tile> = {}): Tile => ({ w, h, ...o });

const PREVIEW: Record<DisplayMode, Tile[]> = {
  grid: Array.from({ length: 6 }, () => t("calc(33% - 6px)", 90)),
  slideshow: [t("100%", 150)],
  contact: Array.from({ length: 7 }, () => t("72px", 72, { frame: "#22201B", pad: "4px" })),
  stack: [
    t("110px", 140, { frame: "#fff", pad: "6px", rot: -5, shadow: PRINT_SHADOW }),
    t("110px", 140, { frame: "#fff", pad: "6px", rot: 3, shadow: PRINT_SHADOW }),
  ],
  scrapbook: [t("120px", 100, { rot: -3 }), t("70px", 90, { rot: 4 }), t("100px", 70, { rot: -2 }), t("80px", 100, { rot: 3 })],
  gallery: [t("100%", 110), ...Array.from({ length: 5 }, () => t("calc(20% - 7px)", 34))],
  filmstrip: Array.from({ length: 6 }, () => t("104px", 130)),
  polaroid: [-5, 3, -2, 5].map((rot) => t("92px", 116, { frame: "#fff", pad: "6px 6px 24px", rot, shadow: PRINT_SHADOW })),
  reel: [t("46%", 120), t("46%", 120)],
  mosaic: [
    [110, 80],
    [70, 80],
    [90, 80],
    [80, 70],
    [120, 70],
    [60, 70],
  ].map(([w, h]) => t(`${w}px`, h, { flex: `1 1 ${w}px` })),
  hero: [t("100%", 100), ...Array.from({ length: 4 }, () => t("calc(25% - 6px)", 40))],
};

export const PREVIEW_NOTE: Partial<Record<DisplayMode, string>> = {
  filmstrip: "Guests swipe sideways through one row.",
  polaroid: "Each print is tilted slightly and keeps its file name as the caption.",
  mosaic: "Rows fill edge to edge. Tap a photo to open it full screen.",
  hero: "The first photo is shown large. The rest sit in a row below.",
  reel: "Photos advance on their own while the page story stays on screen.",
  slideshow: "One photo at a time, advancing on its own. Guests tap the sides to steer.",
  stack: "Guests tap the top print to flip to the next.",
  contact: "A dark film strip guests swipe sideways.",
  gallery: "A big photo with a thumbnail rail to switch.",
  grid: "Two columns. Tap a photo to enlarge it.",
  scrapbook: "Mixed sizes, slightly tilted, taped down.",
};

/** Rough live preview of a mode using the page's real thumbnails (striped
 *  placeholders when there are none yet). */
export function DisplayModePreview({ mode, thumbs }: { mode: DisplayMode; thumbs: string[] }) {
  const tiles = PREVIEW[mode] ?? PREVIEW.grid;
  const nowrap = mode === "filmstrip" || mode === "contact";
  return (
    <div
      className={`border-ink/10 bg-paper flex items-center justify-center gap-2 overflow-hidden rounded-[10px] border p-4 ${
        nowrap ? "flex-nowrap justify-start" : "flex-wrap"
      }`}
    >
      {tiles.map((tile, i) => {
        const src = thumbs.length ? thumbs[i % thumbs.length] : null;
        return (
          <div
            key={i}
            className="box-border shrink-0 rounded-[3px]"
            style={{
              width: tile.w,
              height: tile.h,
              flex: tile.flex,
              background: tile.frame ?? "transparent",
              padding: tile.pad ?? 0,
              boxShadow: tile.shadow,
              transform: tile.rot ? `rotate(${tile.rot}deg)` : undefined,
            }}
          >
            {/* Stripes sit underneath; a thumbnail that fails to load hides
                itself instead of showing a broken-image icon. */}
            <div className="h-full w-full overflow-hidden rounded-[2px]" style={{ background: STRIPES }}>
              {src && (
                <img
                  src={src}
                  alt=""
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
