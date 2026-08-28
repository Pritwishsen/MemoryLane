"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Page } from "@/types/models";

type SortablePageRowProps = {
  page: Page;
  albumId: string;
  onDeleted: (pageId: string) => void;
  onCopied: (message: string) => void;
};

export default function SortablePageRow({
  page,
  albumId,
  onDeleted,
  onCopied,
}: SortablePageRowProps) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

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
      ref={setNodeRef}
      style={style}
      className="border-ink/10 rounded-card overflow-hidden border bg-white"
    >
      <div className="flex items-center gap-3 px-3 py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="text-ink-soft cursor-grab touch-none active:cursor-grabbing"
        >
          ⠿
        </button>

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
          {page.locationName && (
            <div className="text-ink-soft truncate text-sm">
              {page.locationName}
            </div>
          )}
          <div className="font-meta-label text-ink-soft mt-1 flex items-center gap-2 text-[0.6rem]">
            <span className="truncate">tag: {page.nfcSlug}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyLink();
              }}
              title="Copy NFC link"
              className="text-teal shrink-0 normal-case"
            >
              📋
            </button>
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
            className="text-ink-soft hover:text-stamp shrink-0"
          >
            🗑
          </button>
        )}
      </div>
    </li>
  );
}
