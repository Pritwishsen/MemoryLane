"use client";

import { useState } from "react";
import Link from "next/link";
import MapLoader from "./MapLoader";
import FittedPostmark from "./FittedPostmark";
import type { MapPin } from "@/lib/mapGrouping";

export type AlbumPageRow = { id: string; header: string; label: string; slug: string };

type AlbumSummaryClientProps = { pins: MapPin[]; rows: AlbumPageRow[] };

/**
 * Client wrapper around the map and the page-rows list so they can share one
 * highlight state — design_handoff_flag_map_pins v2, GUEST_SCREENS.md's
 * "pin ↔ row link": hovering either a postmark or a row highlights both.
 * `SummaryMap` stays the source of truth for its own place grouping
 * (groupByPlace); rows key into the same place identity via `label`
 * (matching `MapPin.label`'s own derivation, `page.place || page.header`),
 * so a row and its pin always agree on which "place" they represent even
 * when a place has more than one page.
 */
export default function AlbumSummaryClient({ pins, rows }: AlbumSummaryClientProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  return (
    <>
      {pins.length > 0 && (
        <div className="mt-5">
          <MapLoader
            pins={pins}
            heightClassName="h-[220px]"
            highlightedPlaceKey={highlighted}
            onPlaceHover={setHighlighted}
          />
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <span className="font-meta-label text-ink-soft text-[9.5px]">Pages in order</span>
        <span className="font-meta-label text-[9.5px]" style={{ color: "var(--color-brass)" }}>
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-soft mt-3 text-sm">This album doesn&rsquo;t have any pages yet.</p>
      ) : (
        <div className="mt-1">
          {rows.map((row, i) => {
            const placeKey = row.label.trim().toLowerCase();
            return (
              <Link
                key={row.id}
                href={`/p/${row.slug}`}
                onMouseEnter={() => setHighlighted(placeKey)}
                onMouseLeave={() => setHighlighted((k) => (k === placeKey ? null : k))}
                className="flex items-center gap-[13px] rounded-lg px-1 py-[11px] transition-colors"
                style={{
                  borderBottom:
                    i < rows.length - 1 ? "1px solid rgba(34,32,27,.1)" : undefined,
                  background: highlighted === placeKey ? "rgba(31,78,74,.06)" : undefined,
                }}
              >
                <FittedPostmark label={row.label} />
                <span className="text-ink min-w-0 flex-1 truncate text-[14px]">{row.header}</span>
                <span
                  className="shrink-0 text-[15px]"
                  style={{ color: "var(--color-brass)", fontFamily: "var(--font-body)" }}
                >
                  ›
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
