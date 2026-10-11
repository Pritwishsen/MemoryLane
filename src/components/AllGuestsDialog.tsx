"use client";

import { useMemo, useState } from "react";
import Dialog from "./ui/Dialog";
import StatusChip from "./ui/StatusChip";
import { AvatarInitial } from "./ui/Avatar";
import { buttonClass } from "./ui/styles";
import type { GuestRow } from "@/lib/albumEditor";

type Filter = "all" | "needs" | "unopened";

/** Removable guest row; the ✕ asks once before removing. */
export function GuestListRow({
  guest,
  index,
  onRemove,
}: {
  guest: GuestRow;
  index: number;
  onRemove?: (email: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove(guest.email);
    } finally {
      setRemoving(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex min-h-11 items-center gap-2.5">
      <AvatarInitial label={guest.email} index={index} size={28} />
      <span className="text-ink min-w-0 flex-1 truncate text-sm">{guest.email}</span>
      <StatusChip status={guest.status} />
      {onRemove &&
        (confirming ? (
          <span className="flex shrink-0 items-center gap-1 text-[13px]">
            <button
              type="button"
              onClick={remove}
              disabled={removing}
              className="text-stamp min-h-11 px-1.5 font-medium"
            >
              {removing ? "…" : "Remove"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-ink-soft min-h-11 px-1.5">
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${guest.email}`}
            className="text-ink-soft hover:text-stamp flex h-11 w-9 shrink-0 items-center justify-center text-[13px]"
          >
            ✕
          </button>
        ))}
    </div>
  );
}

export default function AllGuestsDialog({
  guests,
  onClose,
  onRemove,
  onInvite,
}: {
  guests: GuestRow[];
  onClose: () => void;
  onRemove: (email: string) => Promise<void>;
  onInvite: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const needsCount = guests.filter((g) => g.status === "needs-access").length;
  const unopenedCount = guests.filter((g) => g.lastViewedAt === null && g.status !== "viewed").length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      if (q && !g.email.includes(q)) return false;
      if (filter === "needs") return g.status === "needs-access";
      if (filter === "unopened") return g.lastViewedAt === null && g.status !== "viewed";
      return true;
    });
  }, [guests, query, filter]);

  const chips: [Filter, string, number][] = [
    ["all", "All", guests.length],
    ["needs", "Needs Drive access", needsCount],
    ["unopened", "Not opened", unopenedCount],
  ];

  return (
    <Dialog
      title={
        <>
          Guests <span className="text-ink-soft text-sm font-normal">· {guests.length}</span>
        </>
      }
      onClose={onClose}
      maxWidth={480}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-soft text-xs">
            Showing {shown.length} of {guests.length}
          </span>
          <button type="button" onClick={onInvite} className={buttonClass("primary", "sm")}>
            + Invite
          </button>
        </div>
      }
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by email"
        className="border-ink/15 text-ink min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`min-h-9 rounded-full px-3 text-xs font-medium ${
              filter === key ? "bg-teal text-white" : "border-ink/15 text-ink border"
            }`}
          >
            {label} {count}
          </button>
        ))}
      </div>
      <div className="border-ink/10 mt-3 border-t">
        {shown.length === 0 ? (
          <p className="text-ink-soft py-6 text-center text-sm">No guests match.</p>
        ) : (
          shown.map((g) => (
            <div key={g.email} className="border-ink/5 border-b py-0.5">
              <GuestListRow guest={g} index={guests.indexOf(g)} onRemove={onRemove} />
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}
