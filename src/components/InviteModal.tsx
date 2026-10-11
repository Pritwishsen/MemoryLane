"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import Dialog from "./ui/Dialog";
import StatusChip from "./ui/StatusChip";
import { AvatarInitial } from "./ui/Avatar";
import { buttonClass } from "./ui/styles";
import { HOST_AUTH_PARAMS } from "@/lib/scopes";
import type { GuestRow, PageStats } from "@/lib/albumEditor";
import type { Page } from "@/types/models";

type InviteModalProps = {
  albumId: string;
  albumTitle: string;
  pages: Page[];
  stats: Record<string, PageStats>;
  guests: GuestRow[];
  /** Host granted full Drive, so folders can be shared from here. */
  canShare: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
  onRemove: (email: string) => Promise<void>;
  onViewAll: () => void;
};

type ShareFailure = { folderId: string; message: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function InviteModal({
  albumId,
  albumTitle,
  pages,
  stats,
  guests,
  canShare,
  onClose,
  onSent,
  onRemove,
  onViewAll,
}: InviteModalProps) {
  // One row per page with a Drive folder; checking a row shares all of that
  // page's folders. Pages without one get a note instead of a row.
  const rows = useMemo(() => pages.filter((p) => p.driveFolderIds.length > 0), [pages]);
  const noFolder = pages.filter((p) => p.driveFolderIds.length === 0);

  const [guestEmail, setGuestEmail] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.map((p) => p.id)));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<{ email: string; items: ShareFailure[] } | null>(null);

  const sharing = canShare && rows.length > 0;
  const selectedFolderIds = [
    ...new Set(rows.filter((p) => selected.has(p.id)).flatMap((p) => p.driveFolderIds)),
  ];
  const totalFolders = new Set(rows.flatMap((p) => p.driveFolderIds)).size;
  const n = sharing ? selectedFolderIds.length : 0;
  const all = sharing && selected.size === rows.length;
  const folderNameFor = (folderId: string) =>
    rows.find((p) => p.driveFolderIds.includes(folderId))?.header ?? "A folder";

  function toggle(pageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestEmail, note, folderIds: sharing ? selectedFolderIds : [] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send the invite");
      const failed: ShareFailure[] = data?.failed ?? [];
      if (failed.length > 0) {
        // The invite went out but some folders didn't share: keep the dialog
        // open so the host sees which ones and why.
        setFailures({ email: guestEmail, items: failed });
        onSent(`Invite sent to ${guestEmail}`);
      } else {
        onSent(
          data?.sharedCount
            ? `Shared ${plural(data.sharedCount, "folder")} and invited ${guestEmail}`
            : `Invite sent to ${guestEmail}`
        );
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the invite");
    } finally {
      setSending(false);
    }
  }

  const blockTone = !sharing ? "border-ink/15" : all ? "border-teal/30" : "border-stamp/40";
  const headTone = !sharing ? "bg-paper/60" : all ? "bg-teal/[0.06]" : "bg-stamp/[0.07]";
  const message = all
    ? `All ${plural(totalFolders, "folder")} will be shared as view-only, so they can see every photo.`
    : n > 0
      ? "Pages from unchecked folders will show as blank to this guest."
      : "Without Drive access, this guest sees no photos at all.";

  if (failures) {
    return (
      <Dialog
        title="Invite sent, with problems"
        onClose={onClose}
        footer={
          <button type="button" onClick={onClose} className={buttonClass("primary", "lg", "w-full")}>
            Done
          </button>
        }
      >
        <p className="text-ink-soft text-sm leading-relaxed">
          {failures.email} got the invite, but these folders couldn&rsquo;t be shared. Pages from them will look
          blank until they&rsquo;re shared in Google Drive.
        </p>
        <ul className="border-stamp/40 mt-4 overflow-hidden rounded-[10px] border">
          {failures.items.map((f, i) => (
            <li key={f.folderId} className={`px-3.5 py-2.5 ${i ? "border-ink/10 border-t" : ""}`}>
              <div className="text-ink text-sm font-medium">{folderNameFor(f.folderId)}</div>
              <div className="text-stamp text-xs">{f.message}</div>
            </li>
          ))}
        </ul>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={<>Invite to &ldquo;{albumTitle}&rdquo;</>}
      onClose={onClose}
      footer={
        <>
          {error && <p className="text-stamp mb-2.5 text-sm">{error}</p>}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !guestEmail.trim()}
            className={buttonClass("primary", "lg", "w-full")}
          >
            {sending
              ? "Sending…"
              : n > 0
                ? `Share ${plural(n, "folder")} & send invite`
                : "Send invite without sharing folders"}
          </button>
        </>
      }
    >
      <label className="block">
        <span className="text-ink-soft text-xs font-medium">Guest email</span>
        <input
          autoFocus
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          placeholder="friend@gmail.com"
          className="border-ink/15 text-ink mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
        />
      </label>
      <label className="mt-3 block">
        <span className="sr-only">Message</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Come relive our trip!"
          className="border-ink/15 text-ink min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
          suppressHydrationWarning
        />
      </label>

      <div className={`mt-5 overflow-hidden rounded-[10px] border ${blockTone}`}>
        <div className={`flex items-center gap-2.5 px-3.5 py-3 ${headTone}`}>
          <div className="min-w-0 flex-1">
            <div className="text-ink text-sm font-semibold">Share Drive folders with this person</div>
            <div
              className={`mt-0.5 text-xs leading-normal ${
                !sharing ? "text-ink-soft" : all ? "text-teal" : "text-stamp"
              }`}
            >
              {rows.length === 0
                ? "No page has a Drive folder yet, so there is nothing to share."
                : !canShare
                  ? "MemoryLane needs permission to share your Drive folders. Reconnect once to turn this on."
                  : message}
            </div>
          </div>
          {sharing ? (
            <button
              type="button"
              onClick={() => setSelected(all ? new Set() : new Set(rows.map((p) => p.id)))}
              className={buttonClass(all ? "secondary" : "primary", "sm", `shrink-0 px-3 text-xs ${all ? "bg-white" : ""}`)}
            >
              {all ? "Clear all" : `Share all ${plural(totalFolders, "folder")}`}
            </button>
          ) : (
            rows.length > 0 && (
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: window.location.href }, HOST_AUTH_PARAMS)}
                className={buttonClass("primary", "sm", "shrink-0 px-3 text-xs")}
              >
                Reconnect Drive
              </button>
            )
          )}
        </div>

        {sharing &&
          rows.map((p) => {
            const on = selected.has(p.id);
            const count = stats[p.id]?.photoCount;
            const meta = [
              count != null
                ? plural(count, "photo")
                : p.driveFolderIds.length > 1
                  ? plural(p.driveFolderIds.length, "folder")
                  : null,
              p.place,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(p.id)}
                className="border-ink/10 flex min-h-11 w-full items-center gap-3 border-t px-3.5 py-2.5 text-left"
              >
                <span
                  aria-hidden="true"
                  className={`border-teal flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-[13px] leading-none text-white ${
                    on ? "bg-teal" : "bg-white"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-sm font-medium">{p.header}</span>
                  {meta && <span className="text-ink-soft block truncate text-xs">{meta}</span>}
                </span>
              </button>
            );
          })}

        {rows.length > 0 && noFolder.length > 0 && (
          <div className="border-ink/10 text-ink-soft border-t px-3.5 py-2 text-xs">
            {noFolder.length === 1
              ? `${noFolder[0].header} has no folder yet, so there is nothing to share.`
              : `${noFolder.length} pages have no folder yet, so there is nothing to share for them.`}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <span className="text-ink text-sm font-semibold">
          Already invited <span className="text-ink-soft font-normal">· {guests.length}</span>
        </span>
        {guests.length > 0 && (
          <button type="button" onClick={onViewAll} className="text-teal min-h-11 text-[13px] font-medium">
            View all ›
          </button>
        )}
      </div>
      <div className="border-ink/10 mt-1 overflow-hidden rounded-[10px] border">
        {guests.length === 0 ? (
          <div className="text-ink-soft p-3.5 text-[13px]">No one invited yet.</div>
        ) : (
          [...guests]
            .reverse()
            .slice(0, 3)
            .map((g, i) => (
              <div
                key={g.email}
                className={`flex min-h-[52px] items-center gap-2.5 px-3 py-2 ${i ? "border-ink/10 border-t" : ""}`}
              >
                <AvatarInitial label={g.email} index={guests.indexOf(g)} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="text-ink truncate text-[13px]">{g.email}</div>
                  <StatusChip status={g.status} className="mt-0.5" />
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(g.email)}
                  aria-label={`Remove ${g.email}`}
                  className="text-stamp min-h-11 shrink-0 px-1 text-[13px] font-medium"
                >
                  Remove
                </button>
              </div>
            ))
        )}
      </div>
    </Dialog>
  );
}
