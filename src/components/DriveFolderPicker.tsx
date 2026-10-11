"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Dialog from "./ui/Dialog";
import { buttonClass } from "./ui/styles";

type Crumb = { id: string; name: string };
type FolderRow = { id: string; name: string };
type Stats = { count: number; capped: boolean; thumb: string | null } | null;

const STRIPES = "repeating-linear-gradient(135deg,#ded5c0 0 6px,#d4cab3 6px 12px)";

/** "Choose a Drive folder" dialog: browse My Drive / Shared with me with a
 *  breadcrumb, tap a row to select it, › to open it. The footer uses the
 *  selected folder, or the folder you're inside if nothing is selected. */
export default function DriveFolderPicker({
  onPick,
  onClose,
  title = "Choose a Drive folder",
}: {
  onPick: (folder: Crumb) => void;
  onClose: () => void;
  title?: string;
}) {
  const [parent, setParent] = useState("root");
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: "root", name: "My Drive" }]);
  const [folders, setFolders] = useState<FolderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Crumb | null>(null);
  const [stats, setStats] = useState<Record<string, Stats>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/drive/folders?parent=${encodeURIComponent(parent)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Couldn't read your Drive");
        return data as { breadcrumb: Crumb[]; folders: FolderRow[] };
      })
      .then(async (data) => {
        if (cancelled) return;
        setCrumbs(data.breadcrumb);
        setFolders(data.folders);
        // Counts and thumbnails arrive afterwards, in batches.
        const ids = data.folders.map((x) => x.id);
        for (let i = 0; i < ids.length && !cancelled; i += 20) {
          const res = await fetch(`/api/drive/folders?stats=${ids.slice(i, i + 20).join(",")}`);
          const body = await res.json().catch(() => null);
          if (!cancelled && body?.stats) setStats((prev) => ({ ...prev, ...body.stats }));
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't read your Drive"));
    return () => {
      cancelled = true;
    };
  }, [parent]);

  function open(id: string) {
    setFolders(null);
    setError(null);
    setSelected(null);
    setParent(id);
  }

  const current = crumbs[crumbs.length - 1];
  const inRealFolder = parent !== "root" && parent !== "shared";
  const choice = selected ?? (inRealFolder ? current : null);
  const root = crumbs[0]?.id === "shared" ? "shared" : "root";

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!choice}
          onClick={() => choice && onPick(choice)}
          className={buttonClass("primary", "lg", "w-full")}
        >
          {choice ? <span className="truncate">Use &ldquo;{choice.name}&rdquo;</span> : "Select a folder"}
        </button>
      }
    >
      <div className="flex gap-1.5">
        {(
          [
            ["root", "My Drive"],
            ["shared", "Shared with me"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => open(id)}
            className={`min-h-9 rounded-full px-3 text-xs font-medium ${
              root === id ? "bg-teal text-white" : "border-ink/15 text-ink border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <nav aria-label="Folder path" className="text-ink-soft mt-2.5 flex flex-wrap items-center gap-x-1 text-xs">
        {crumbs.map((c, i) => (
          <span key={c.id} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">›</span>}
            {i < crumbs.length - 1 ? (
              <button type="button" onClick={() => open(c.id)} className="hover:text-teal min-h-8 underline-offset-2 hover:underline">
                {c.name}
              </button>
            ) : (
              <span className="text-ink font-medium">{c.name}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="-mx-3 mt-2 pb-1">
        {error ? (
          <p className="text-stamp px-3 py-6 text-sm">{error}</p>
        ) : folders === null ? (
          <p className="text-ink-soft px-3 py-6 text-sm">Loading folders…</p>
        ) : folders.length === 0 ? (
          <p className="text-ink-soft px-3 py-6 text-sm">
            {inRealFolder ? "No folders inside this one." : "No folders here."}
          </p>
        ) : (
          folders.map((f) => {
            const isSel = selected?.id === f.id;
            return (
              <div
                key={f.id}
                className={`flex min-h-14 items-center gap-1 rounded-lg ${isSel ? "bg-teal/[0.08]" : "hover:bg-paper/70"}`}
              >
                <button
                  type="button"
                  onClick={() => setSelected(isSel ? null : { id: f.id, name: f.name })}
                  onDoubleClick={() => open(f.id)}
                  aria-pressed={isSel}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left"
                >
                  <span
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded"
                    style={{ background: STRIPES }}
                  >
                    {stats[f.id]?.thumb && (
                      <Image src={stats[f.id]!.thumb!} alt="" fill sizes="40px" className="object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block truncate text-sm font-medium">{f.name}</span>
                    <span className="text-ink-soft block text-xs">
                      {!(f.id in stats)
                        ? "Counting photos…"
                        : stats[f.id] === null
                          ? "Folder"
                          : `${stats[f.id]!.count}${stats[f.id]!.capped ? "+" : ""} ${stats[f.id]!.count === 1 ? "photo" : "photos"}`}
                    </span>
                  </span>
                  {isSel && <span className="text-teal shrink-0 text-base">✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => open(f.id)}
                  aria-label={`Open ${f.name}`}
                  className="text-ink-soft hover:text-teal flex h-11 w-11 shrink-0 items-center justify-center text-lg"
                >
                  ›
                </button>
              </div>
            );
          })
        )}
      </div>
    </Dialog>
  );
}
