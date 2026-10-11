"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Postmark from "./Postmark";
import Image from "next/image";
import { DISPLAY_MODE_NAME } from "@/lib/displayModes";
import type { PageStats } from "@/lib/albumEditor";
import type { Page } from "@/types/models";

type SortablePageRowProps = {
  page: Page;
  albumId: string;
  onDeleted: (pageId: string) => void;
  onCopied: (message: string) => void;
  stats?: PageStats;
  /** Drive stats still on their way: show a placeholder, not a verdict. */
  statsLoading?: boolean;
  /** True for the page just added by "+ add page" — on a long page list, a
   *  new row appends off-screen at the bottom with nothing to show for it.
   *  This scrolls it into view and gives it a brief highlight so it's
   *  obvious something happened. */
  isNew?: boolean;
};

export default function SortablePageRow({
  page,
  albumId,
  onDeleted,
  onCopied,
  stats,
  statsLoading = false,
  isNew = false,
}: SortablePageRowProps) {
  const hasFolder = page.driveFolderIds.length > 0;
  const photoCount = stats?.photoCount ?? null;
  const problem = !hasFolder || photoCount === 0;
  const stateText = !hasFolder
    ? "Add a Drive folder to show photos"
    : photoCount === 0
      ? "No photos found in the folder"
      : "Folder connected";
  const metaParts = [
    [page.place, page.country].filter(Boolean).join(", "),
    !hasFolder
      ? "No folder yet"
      : statsLoading
        ? "Counting photos…"
        : photoCount === null
          ? null
          : `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`,
    hasFolder ? DISPLAY_MODE_NAME[page.displayMode] ?? page.displayMode : null,
  ].filter(Boolean);
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rootRef = useRef<HTMLLIElement | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  useEffect(() => {
    if (isNew) {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isNew]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/albums/${albumId}/pages/${page.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      onDeleted(page.id);
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/p/${page.nfcSlug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => onCopied("Link copied — write it to your NFC tag"))
      .catch(() => onCopied("Couldn't copy the link"));
  }

  return (
    <li
      ref={(node) => {
        setNodeRef(node);
        rootRef.current = node;
      }}
      style={style}
      className={`overflow-hidden rounded-xl border bg-white transition-shadow duration-700 ${
        problem ? "border-stamp/35" : "border-ink/10"
      } ${
        isNew ? "ring-teal ring-2 ring-offset-2" : ""
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="text-ink-soft -ml-1 flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-base active:cursor-grabbing"
        >
          ⠿
        </button>

        <div
          aria-hidden="true"
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md"
          style={{ background: "repeating-linear-gradient(135deg,#ded5c0 0 6px,#d4cab3 6px 12px)" }}
        >
          {stats?.thumbUrl && <Image src={stats.thumbUrl} alt="" fill sizes="56px" className="object-cover" />}
        </div>

        {/*
          A native <button> can't contain another <button> (the copy-link
          icon below) — that's invalid HTML and breaks hydration. This div
          plays the "click to open the page editor" role instead, with the
          ARIA/keyboard bits a real button gets for free added by hand.
        */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/dashboard/${albumId}/page/${page.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(`/dashboard/${albumId}/page/${page.id}`);
            }
          }}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <div className="text-ink truncate font-medium">{page.header}</div>
          {metaParts.length > 0 && (
            <div className="text-ink-soft mt-px truncate text-[13px]">{metaParts.join(" · ")}</div>
          )}
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
            <span
              aria-hidden="true"
              className={`h-[7px] w-[7px] shrink-0 rounded-full ${problem ? "bg-stamp" : "bg-teal"}`}
            />
            <span className={`truncate ${problem ? "text-stamp" : "text-teal"}`}>{stateText}</span>
            {page.nfcSlug ? (
              <>
                <span className="text-ink/30">·</span>
                <span className="font-meta text-ink-soft truncate text-[11px]">/p/{page.nfcSlug}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyLink();
                  }}
                  title="Copy page link"
                  aria-label="Copy page link"
                  className="-my-3 flex h-11 w-7 shrink-0 items-center justify-center"
                >
                  <Postmark size="xs" rotate={-4} />
                </button>
              </>
            ) : (
              <span className="text-ink-soft truncate">· not saved yet</span>
            )}
          </div>
        </div>

        {confirmingDelete ? (
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-stamp font-medium"
            >
              {deleting ? "…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-ink-soft"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            title="Delete page"
            aria-label="Delete page"
            className="text-ink-soft hover:text-stamp flex h-11 w-9 shrink-0 items-center justify-center"
          >
            🗑
          </button>
        )}
      </div>
    </li>
  );
}
