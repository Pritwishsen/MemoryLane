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
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { backLinkClass, buttonClass } from "@/components/ui/styles";
import Toast, { useToast } from "@/components/ui/Toast";
import Dialog from "@/components/ui/Dialog";
import { AvatarStack } from "@/components/ui/Avatar";
import SortablePageRow from "./SortablePageRow";
import InviteModal from "./InviteModal";
import AccountBadge from "./AccountBadge";
import AllGuestsDialog, { GuestListRow } from "./AllGuestsDialog";
import type { EditorDriveData, GuestRow, PageStats } from "@/lib/albumEditor";
import type { Album, Page } from "@/types/models";

type AlbumEditorClientProps = {
  album: Album;
  initialPages: Page[];
  initialGuests: GuestRow[];
  /** Host granted full Drive (invite can share folders). */
  canShare: boolean;
  userName: string | null;
  userImage: string | null;
  userEmail: string | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);

/** Guest rows for the summary card: people needing attention first, then
 *  the rest, newest invite first. */
function summaryOrder(guests: GuestRow[]): GuestRow[] {
  const needs = guests.filter((g) => g.status === "needs-access");
  const rest = guests.filter((g) => g.status !== "needs-access").reverse();
  return [...needs, ...rest];
}

export default function AlbumEditorClient({
  album,
  initialPages,
  initialGuests,
  canShare,
  userName,
  userImage,
  userEmail,
}: AlbumEditorClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(album.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [introText, setIntroText] = useState(album.introText ?? "");
  const [pages, setPages] = useState(initialPages);
  const [guests, setGuests] = useState(initialGuests);
  const [addingPage, setAddingPage] = useState(false);
  const [newPageId, setNewPageId] = useState<string | null>(null);
  const [toast, setToast] = useToast();
  const [confirmingDeleteAlbum, setConfirmingDeleteAlbum] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showingGuests, setShowingGuests] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  // A sent invite triggers router.refresh(); pick up the server's new list
  // (React's "adjust state when a prop changes" pattern, no effect needed).
  const [guestsSource, setGuestsSource] = useState(initialGuests);
  // Photo counts, thumbnails and guest Drive access load after first paint
  // (they need dozens of Drive calls); null until the first answer arrives.
  const [stats, setStats] = useState<Record<string, PageStats>>({});
  const [accessChecked, setAccessChecked] = useState(false);
  const [driveLoaded, setDriveLoaded] = useState(false);
  const [driveVersion, setDriveVersion] = useState(0);
  if (guestsSource !== initialGuests) {
    setGuestsSource(initialGuests);
    setGuests(initialGuests);
    setDriveVersion((v) => v + 1);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/albums/${album.id}/editor-data`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: EditorDriveData | null) => {
        if (cancelled) return;
        setDriveLoaded(true);
        if (!data) return;
        setStats(data.stats);
        setAccessChecked(data.accessChecked);
        // Keep local removals: only take statuses for guests still listed.
        setGuests((prev) => {
          const fresh = new Map(data.guests.map((g) => [g.email, g]));
          return prev.map((g) => fresh.get(g.email) ?? g);
        });
      })
      .catch(() => !cancelled && setDriveLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [album.id, driveVersion]);

  useEffect(() => {
    if (!newPageId) return;
    const t = setTimeout(() => setNewPageId(null), 2000);
    return () => clearTimeout(t);
  }, [newPageId]);

  const needsCount = guests.filter((g) => g.status === "needs-access").length;
  const shared = guests.length > 0;
  const cardGuests = summaryOrder(guests).slice(0, 4);

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
      setNewPageId(page.id);
      setToast("New page added");
    } finally {
      setAddingPage(false);
    }
  }

  function handlePageDeleted(pageId: string) {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  }

  async function handleRemoveGuest(email: string) {
    const res = await fetch(`/api/albums/${album.id}/invites`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestEmail: email }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setToast(data?.error ?? "Couldn't remove that guest — try again");
      return;
    }
    setGuests((prev) => prev.filter((g) => g.email !== email));
    setToast(
      data?.unrevoked
        ? `Removed ${email}, but some Drive access couldn't be revoked — check sharing in Drive`
        : `Removed ${email}`
    );
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
      setToast("Couldn't delete the album — try again");
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

  function openInvite() {
    setShowingGuests(false);
    setInviting(true);
  }

  return (
    <main className="flex-1 px-5 pb-10 pt-6 sm:px-10">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className={backLinkClass}>
            ← Your albums
          </Link>
          <AccountBadge name={userName} image={userImage} email={userEmail} />
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-[1_1_260px]">
            {editingTitle ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="font-display text-ink border-teal w-full border-b bg-transparent text-2xl font-semibold focus:outline-none sm:text-[30px]"
              />
            ) : (
              <h1
                onClick={() => setEditingTitle(true)}
                className="font-display text-ink cursor-text text-2xl font-semibold sm:text-[30px]"
                title="Click to rename"
              >
                {title}
              </h1>
            )}
            <p className="text-ink-soft mt-1 text-sm">
              {plural(pages.length, "page")} · {plural(guests.length, "guest")} · {shared ? "Shared" : "Private"}
            </p>
          </div>
          <button type="button" onClick={openInvite} className={buttonClass("primary", "md")}>
            Invite guests
          </button>
        </div>

        <div className="border-ink/10 mt-5 rounded-xl border bg-white px-4 py-3.5">
          {guests.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-ink text-sm font-semibold">No guests yet</div>
                <div className="text-ink-soft mt-px text-xs">Only you can see this album.</div>
              </div>
              <button type="button" onClick={openInvite} className="text-teal min-h-11 text-[13px] font-medium">
                Invite someone ›
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <AvatarStack labels={guests.map((g) => g.email)} max={5} />
                <div className="min-w-[140px] flex-1">
                  <div className="text-ink text-sm font-semibold">{plural(guests.length, "guest")}</div>
                  {needsCount > 0 ? (
                    <div className="text-stamp mt-px text-xs">
                      {needsCount} need{needsCount === 1 ? "s" : ""} Drive access
                    </div>
                  ) : (
                    <div className="text-ink-soft mt-px text-xs">
                      {!driveLoaded
                        ? "Checking Drive access…"
                        : accessChecked
                          ? "Everyone can see the photos"
                          : "Drive access not checked"}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowingGuests(true)}
                  className="text-teal min-h-11 text-[13px] font-medium"
                >
                  View all ›
                </button>
              </div>
              <div className="border-ink/10 mt-3 border-t pt-2.5">
                <div className="font-meta-label text-ink-soft mb-1 text-[11px]">
                  {needsCount > 0 ? "Needs attention" : "Guests"}
                </div>
                {cardGuests.map((g) => (
                  <GuestListRow key={g.email} guest={g} index={guests.indexOf(g)} />
                ))}
              </div>
            </>
          )}
        </div>

        <label className="mt-4 block">
          <span className="text-ink-soft text-xs font-medium">Intro message guests see</span>
          <textarea
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
            onBlur={handleIntroSave}
            rows={2}
            placeholder="Here's everywhere we went — tap a souvenir to relive it"
            className="border-ink/15 text-ink mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
            suppressHydrationWarning
          />
        </label>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-display text-ink text-lg font-semibold">Pages</h2>
          <button
            type="button"
            onClick={handleAddPage}
            disabled={addingPage}
            className={buttonClass("secondary", "sm")}
          >
            {addingPage ? "Adding…" : "+ Add page"}
          </button>
        </div>
        <p className="text-ink-soft mt-1.5 text-[13px]">Guests see pages in this order. Drag to reorder.</p>

        {pages.length === 0 ? (
          <p className="text-ink-soft mt-6 text-center text-sm">
            This album is empty. Add your first page to get started.
          </p>
        ) : (
          <DndContext
            // Fixed id: dnd-kit otherwise numbers its a11y ids from a global
            // counter that differs between server and client (hydration error).
            id="album-pages"
            sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="mt-3 flex flex-col gap-2">
                {pages.map((page) => (
                  <SortablePageRow
                    key={page.id}
                    page={page}
                    albumId={album.id}
                    stats={stats[page.id]}
                    statsLoading={!driveLoaded}
                    onDeleted={handlePageDeleted}
                    onCopied={setToast}
                    isNew={page.id === newPageId}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <hr className="border-ink/10 mt-9" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-ink text-sm font-medium">Delete album</div>
            <div className="text-ink-soft text-[13px]">Guests lose access. Your Drive photos are not touched.</div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingDeleteAlbum(true)}
            className={buttonClass("danger-outline", "sm")}
          >
            Delete album
          </button>
        </div>
      </div>

      {confirmingDeleteAlbum && (
        <Dialog
          title={<>Delete &ldquo;{title}&rdquo;?</>}
          onClose={() => !deletingAlbum && setConfirmingDeleteAlbum(false)}
          compact
          maxWidth={400}
          footer={
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingDeleteAlbum(false)}
                disabled={deletingAlbum}
                className={buttonClass("ghost", "md")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAlbum}
                disabled={deletingAlbum}
                className={buttonClass("danger", "md")}
              >
                {deletingAlbum ? "Deleting…" : "Delete album"}
              </button>
            </div>
          }
        >
          <p className="text-ink-soft mt-2.5 text-sm leading-relaxed">
            {guests.length > 0
              ? `This removes the album, its ${plural(pages.length, "page")} and guest access for ${people(guests.length)}.`
              : `This removes the album and its ${plural(pages.length, "page")}.`}{" "}
            Your photos stay in Google Drive.
          </p>
        </Dialog>
      )}

      {showingGuests && (
        <AllGuestsDialog
          guests={guests}
          onClose={() => setShowingGuests(false)}
          onRemove={handleRemoveGuest}
          onInvite={openInvite}
        />
      )}

      {inviting && (
        <InviteModal
          albumId={album.id}
          albumTitle={title}
          pages={pages}
          stats={stats}
          guests={guests}
          canShare={canShare}
          onRemove={handleRemoveGuest}
          onViewAll={() => {
            setInviting(false);
            setShowingGuests(true);
          }}
          onClose={() => setInviting(false)}
          onSent={(message) => {
            setToast(message);
            router.refresh();
          }}
        />
      )}

      <Toast message={toast} />
    </main>
  );
}
