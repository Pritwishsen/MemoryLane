"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SortablePageRow from "./SortablePageRow";
import InviteModal from "./InviteModal";
import AccountBadge from "./AccountBadge";
import type { Album, Page } from "@/types/models";

type AlbumEditorClientProps = {
  album: Album;
  initialPages: Page[];
  userName: string | null;
  userImage: string | null;
  userEmail: string | null;
};

export default function AlbumEditorClient({
  album,
  initialPages,
  userName,
  userImage,
  userEmail,
}: AlbumEditorClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(album.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [introText, setIntroText] = useState(album.introText ?? "");
  const [pages, setPages] = useState(initialPages);
  const [addingPage, setAddingPage] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmingDeleteAlbum, setConfirmingDeleteAlbum] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [inviting, setInviting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleTitleSave() {
    setEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed || trimmed === album.title) {
      setTitle(album.title);
      return;
    }
    await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
  }

  async function handleIntroSave() {
    if (introText === (album.introText ?? "")) return;
    await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ introText }),
    });
  }

  async function handleAddPage() {
    setAddingPage(true);
    try {
      const res = await fetch(`/api/albums/${album.id}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ header: "Untitled" }),
      });
      if (!res.ok) throw new Error("Failed to add page");
      const { page } = await res.json();
      setPages((prev) => [...prev, page]);
    } finally {
      setAddingPage(false);
    }
  }

  function handlePageDeleted(pageId: string) {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  }

  async function handleDeleteAlbum() {
    setDeletingAlbum(true);
    try {
      const res = await fetch(`/api/albums/${album.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete album");
      router.push("/dashboard");
    } catch {
      setDeletingAlbum(false);
      setConfirmingDeleteAlbum(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(pages, oldIndex, newIndex);
    setPages(reordered);

    await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageOrder: reordered.map((p) => p.id) }),
    });
  }

  return (
    <main className="flex-1 px-5 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="font-meta-label text-ink-soft hover:text-ink">
            ← Albums
          </Link>
          <AccountBadge name={userName} image={userImage} email={userEmail} />
        </div>

        <div className="mt-4">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="font-display text-ink border-teal w-full border-b bg-transparent text-2xl font-semibold focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="font-display text-ink cursor-text text-2xl font-semibold"
              title="Click to rename"
            >
              {title}
            </h1>
          )}
          <p className="text-ink-soft mt-1 text-sm">
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </p>
        </div>

        <label className="mt-4 block">
          <span className="font-meta-label text-ink-soft text-xs">
            Guest intro message
          </span>
          <textarea
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
            onBlur={handleIntroSave}
            rows={2}
            placeholder="Here's everywhere we went — tap a souvenir to relive it"
            className="border-ink/15 text-ink mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={() => setInviting(true)}
          className="border-brass text-brass mt-4 rounded-full border px-5 py-2 text-sm font-medium"
        >
          Invite guests
        </button>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-display text-ink text-lg font-semibold">Pages</h2>
          <button
            type="button"
            onClick={handleAddPage}
            disabled={addingPage}
            className="font-meta-label text-teal"
          >
            {addingPage ? "adding…" : "+ add page"}
          </button>
        </div>
        <hr className="border-ink/10 mt-3" />

        {pages.length === 0 ? (
          <p className="text-ink-soft mt-6 text-center text-sm">
            This album is empty. Add your first page to get started.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pages.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="mt-4 flex flex-col gap-2">
                {pages.map((page) => (
                  <SortablePageRow
                    key={page.id}
                    page={page}
                    albumId={album.id}
                    onDeleted={handlePageDeleted}
                    onCopied={setToast}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <hr className="border-ink/10 mt-10" />
        <div className="mt-4">
          {confirmingDeleteAlbum ? (
            <div className="border-stamp/30 rounded-card border bg-white p-4">
              <p className="text-ink text-sm">
                Delete <strong>{title}</strong> and all {pages.length}{" "}
                {pages.length === 1 ? "page" : "pages"} in it? This can&rsquo;t
                be undone.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleDeleteAlbum}
                  disabled={deletingAlbum}
                  className="text-stamp text-sm font-medium"
                >
                  {deletingAlbum ? "Deleting…" : "Delete album"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteAlbum(false)}
                  className="text-ink-soft text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDeleteAlbum(true)}
              className="border-stamp/40 text-stamp hover:bg-stamp/5 rounded-full border px-4 py-1.5 text-sm font-medium"
            >
              Delete album
            </button>
          )}
        </div>
      </div>

      {inviting && (
        <InviteModal
          albumId={album.id}
          albumTitle={title}
          onClose={() => setInviting(false)}
          onSent={setToast}
        />
      )}

      {toast && (
        <div className="bg-ink font-meta-label fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
