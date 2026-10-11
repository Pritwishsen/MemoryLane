"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountBadge from "./AccountBadge";
import RingStamp from "./RingStamp";
import Dialog from "./ui/Dialog";
import { AvatarStack } from "./ui/Avatar";
import { buttonClass } from "./ui/styles";
import type { AlbumCard } from "@/lib/dashboard";

type DashboardClientProps = {
  albums: AlbumCard[];
  userName: string | null;
  userImage: string | null;
  userEmail: string | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const PLACEHOLDER_STRIPES = "repeating-linear-gradient(135deg,#ded5c0 0 8px,#d4cab3 8px 16px)";

function AlbumTile({ album }: { album: AlbumCard }) {
  const shared = album.guestEmails.length > 0;
  return (
    <Link
      href={`/dashboard/${album.id}`}
      className="border-ink/10 group block overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(34,32,27,0.05)] transition hover:shadow-md"
    >
      <div className="relative h-[140px]" style={{ background: PLACEHOLDER_STRIPES }}>
        {album.coverUrl && (
          <Image
            src={album.coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
          />
        )}
        <span
          className={`absolute right-2.5 top-2.5 rounded-full px-2.5 py-[3px] text-[11px] font-medium ${
            shared ? "bg-chip-viewed text-teal" : "bg-chip-invited text-ink-soft"
          }`}
        >
          {shared ? "Shared" : "Private"}
        </span>
      </div>
      <div className="px-4 pb-4 pt-3.5">
        <div className="font-display text-ink truncate text-[17px] font-semibold">{album.title}</div>
        <div className="text-ink-soft mt-1 text-[13px]">
          {plural(album.pageCount, "page")} ·{" "}
          {shared ? plural(album.guestEmails.length, "guest") : "not shared yet"}
        </div>
        <div className="mt-3 flex min-h-7 items-center justify-between">
          {shared ? (
            <AvatarStack labels={album.guestEmails} max={4} size={26} />
          ) : (
            <span className="text-ink-soft text-xs">Only you</span>
          )}
          <span className="text-teal text-[13px] font-medium group-hover:underline">Edit ›</span>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardClient({ albums, userName, userImage, userEmail }: DashboardClientProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalPages = albums.reduce((n, a) => n + a.pageCount, 0);
  const totalGuests = new Set(albums.flatMap((a) => a.guestEmails)).size;

  function openCreate() {
    setNewTitle("");
    setError(null);
    setIsCreating(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      setError("Give the album a title first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to create album");
      const { album } = await res.json();
      router.push(`/dashboard/${album.id}`);
    } catch {
      setError("Couldn't create the album — try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 px-5 pb-10 pt-6 sm:px-10">
      <div className="mx-auto w-full max-w-[960px]">
        <div className="flex items-center justify-between">
          <span className="font-display text-ink text-lg font-bold">MemoryLane</span>
          <AccountBadge name={userName} image={userImage} email={userEmail} />
        </div>

        <div className="mt-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-ink text-2xl font-semibold sm:text-[32px]">Your albums</h1>
            <p className="text-ink-soft mt-1 text-sm">
              {albums.length === 0
                ? "Nothing here yet"
                : `${plural(albums.length, "album")} · ${plural(totalPages, "page")} · ${plural(totalGuests, "guest")}`}
            </p>
          </div>
          {albums.length > 0 && (
            <button type="button" onClick={openCreate} className={buttonClass("primary", "md")}>
              + New album
            </button>
          )}
        </div>

        {albums.length === 0 ? (
          <div className="border-ink/10 mt-8 flex flex-col items-center rounded-[14px] border bg-white px-6 py-10 text-center sm:py-14">
            <RingStamp label="FIRST ALBUM" id="empty" size={88} fontSize={9} letterSpacing={1.2} />
            <h2 className="font-display text-ink mt-6 text-[22px] font-semibold">Make your first album</h2>
            <p className="text-ink-soft mt-2 max-w-[380px] text-[15px] leading-relaxed">
              Name it, add a page for each place with a Drive folder of photos, then invite the people
              who should see it.
            </p>
            <button type="button" onClick={openCreate} className={buttonClass("primary", "lg", "mt-6 px-7")}>
              Create album
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
            {albums.map((album) => (
              <AlbumTile key={album.id} album={album} />
            ))}
            <button
              type="button"
              onClick={openCreate}
              className="border-teal/40 text-teal hover:bg-teal/5 flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed transition"
            >
              <span className="text-[28px] leading-none">+</span>
              <span className="text-sm font-medium">Start a new album</span>
            </button>
          </div>
        )}
      </div>

      {isCreating && (
        <Dialog title="New album" onClose={() => setIsCreating(false)} compact maxWidth={400}>
          <form onSubmit={handleCreate}>
            <label className="mt-4 block">
              <span className="text-ink-soft text-xs font-medium">Album title</span>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Summer in Rajasthan"
                className="border-ink/15 text-ink mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
              />
            </label>
            {error && <p className="text-stamp mt-2 text-sm">{error}</p>}
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setIsCreating(false)} className={buttonClass("ghost", "md")}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className={buttonClass("primary", "md")}>
                {submitting ? "Creating…" : "Create album"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </main>
  );
}
