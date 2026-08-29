"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccountBadge from "./AccountBadge";
import type { Album } from "@/types/models";

type DashboardClientProps = {
  albums: Album[];
  userName: string | null;
  userImage: string | null;
};

export default function DashboardClient({
  albums,
  userName,
  userImage,
}: DashboardClientProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <main className="flex-1 px-5 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex items-center justify-between">
          <span className="font-display text-ink text-lg font-bold">
            MemoryLane
          </span>
          <AccountBadge name={userName} image={userImage} />
        </div>

        <div className="mt-10 flex items-center justify-between">
          <h1 className="font-display text-ink text-xl font-semibold">
            Your Albums
          </h1>
          <button
            type="button"
            onClick={() => setIsCreating((v) => !v)}
            className="font-meta-label text-teal"
          >
            {isCreating ? "cancel" : "+ new"}
          </button>
        </div>
        <hr className="border-ink/10 mt-3" />

        {isCreating && (
          <form onSubmit={handleCreate} className="mt-4 flex gap-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Album title, e.g. Summer in Rajasthan"
              className="border-ink/10 rounded-card flex-1 border bg-white px-4 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-teal rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </form>
        )}
        {error && <p className="text-stamp mt-2 text-sm">{error}</p>}

        {albums.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-ink-soft text-sm">
              No albums yet. Every trip starts somewhere — create your first
              one.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {albums.map((album) => (
              <li key={album.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/${album.id}`)}
                  className="border-ink/10 rounded-card w-full border bg-white px-4 py-3 text-left transition hover:shadow-sm"
                >
                  <div className="text-ink font-medium">{album.title}</div>
                  <div className="font-meta-label text-ink-soft mt-1 text-[0.65rem]">
                    {album.pageOrder.length}{" "}
                    {album.pageOrder.length === 1 ? "page" : "pages"} ·
                    created{" "}
                    {new Date(album.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
