"use client";

import { useState } from "react";

type InviteModalProps = {
  albumId: string;
  albumTitle: string;
  onClose: () => void;
  onSent: (message: string) => void;
};

export default function InviteModal({ albumId, albumTitle, onClose, onSent }: InviteModalProps) {
  const [guestEmail, setGuestEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${albumId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestEmail, note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Couldn't send the invite");
      }
      onSent(`Invite sent to ${guestEmail}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the invite");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="rounded-card w-full max-w-[420px] bg-white p-6 shadow-lg"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-ink text-lg font-semibold">
            Invite to &ldquo;{albumTitle}&rdquo;
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        <label className="mt-5 block">
          <span className="text-ink-soft text-xs font-medium">Guest email</span>
          <input
            autoFocus
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="friend@email.com"
            className="border-ink/15 text-ink mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-ink-soft text-xs font-medium">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Come relive our trip!"
            className="border-ink/15 text-ink mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
          />
        </label>

        <p className="text-stamp bg-stamp/5 mt-4 rounded-lg p-3 text-xs leading-relaxed">
          ⚠ Remember to share your Drive folders with this email too — that&rsquo;s what
          actually lets them see the photos.
        </p>

        {error && <p className="text-stamp mt-3 text-sm">{error}</p>}

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !guestEmail}
          className="bg-teal mt-5 w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send invite"}
        </button>
      </div>
    </div>
  );
}
