"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AccountBadge from "./AccountBadge";
import type { DisplayMode, ImageFilter, Page } from "@/types/models";

type PageEditorClientProps = {
  albumId: string;
  page: Page;
  /** Read server-side from the request's Host header (see page.tsx) rather
   *  than window.location client-side, so the NFC link's host renders
   *  identically on the server and on hydration — no mismatch. */
  host: string;
  userName: string | null;
  userImage: string | null;
  userEmail: string | null;
};

type DriveCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; name: string }
  | { status: "error"; message: string };

export default function PageEditorClient({
  albumId,
  page,
  host,
  userName,
  userImage,
  userEmail,
}: PageEditorClientProps) {
  const [header, setHeader] = useState(page.header);
  const [bodyText, setBodyText] = useState(page.bodyText);
  const [place, setPlace] = useState(page.place ?? "");
  const [country, setCountry] = useState(page.country ?? "");
  const initialFolders = page.driveFolderIds?.length ? page.driveFolderIds : [""];
  const [driveFolderInputs, setDriveFolderInputs] = useState<string[]>(initialFolders);
  const [imageFilter, setImageFilter] = useState<ImageFilter>(page.imageFilter);
  const [tagKeyword, setTagKeyword] = useState(page.tagKeyword);
  const [randomizeAll, setRandomizeAll] = useState(page.randomizeAll ?? false);
  const [randomLimit, setRandomLimit] = useState(page.randomLimit ?? 20);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(page.displayMode);
  const [slideshowIntervalSec, setSlideshowIntervalSec] = useState(
    page.slideshowIntervalSec ?? 4
  );

  const [nfcSlug, setNfcSlug] = useState(page.nfcSlug);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [driveChecks, setDriveChecks] = useState<DriveCheckState[]>(
    initialFolders.map((f) => (f ? { status: "checking" } : { status: "idle" }))
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (page.driveFolderIds?.length) {
      checkFolders(page.driveFolderIds);
    }
    // Only run once on mount for the folders this page already had saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkFolders(folderIds: string[]) {
    if (folderIds.length === 0) return;
    setDriveChecks(folderIds.map(() => ({ status: "checking" })));
    try {
      const res = await fetch(
        `/api/albums/${albumId}/pages/${page.id}/drive-check?folderIds=${encodeURIComponent(folderIds.join(","))}`
      );
      const data = await res.json();
      const results: Array<{ folderId: string; ok: boolean; name?: string; error?: string }> =
        data.results ?? [];
      setDriveChecks(
        folderIds.map((id) => {
          const match = results.find((r) => r.folderId === id);
          if (!match) return { status: "error", message: "No result" };
          return match.ok
            ? { status: "ok", name: match.name ?? "" }
            : { status: "error", message: match.error ?? "Couldn't access this folder" };
        })
      );
    } catch {
      setDriveChecks(
        folderIds.map(() => ({ status: "error", message: "Couldn't reach Google Drive" }))
      );
    }
  }

  function updateFolderInput(index: number, value: string) {
    setDriveFolderInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function addFolderRow() {
    setDriveFolderInputs((prev) => [...prev, ""]);
    setDriveChecks((prev) => [...prev, { status: "idle" }]);
  }

  function removeFolderRow(index: number) {
    setDriveFolderInputs((prev) => prev.filter((_, i) => i !== index));
    setDriveChecks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/albums/${albumId}/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header,
          bodyText,
          place,
          country,
          driveFolderInputs,
          imageFilter,
          tagKeyword,
          randomizeAll,
          randomLimit,
          displayMode,
          slideshowIntervalSec,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save");
      }
      const { page: updated } = await res.json();
      setHeader(updated.header);
      setNfcSlug(updated.nfcSlug);
      setToast("Saved");

      const savedFolders: string[] = updated.driveFolderIds ?? [];
      setDriveFolderInputs(savedFolders.length > 0 ? savedFolders : [""]);
      if (savedFolders.length > 0) {
        checkFolders(savedFolders);
      } else {
        setDriveChecks([{ status: "idle" }]);
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/p/${nfcSlug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => setToast("Link copied — write it to your NFC tag"))
      .catch(() => setToast("Couldn't copy the link"));
  }

  return (
    <main className="flex-1 px-5 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/${albumId}`}
            className="font-meta-label text-ink-soft hover:text-ink"
          >
            ← Back to album
          </Link>
          <AccountBadge name={userName} image={userImage} email={userEmail} />
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <label className="block">
            <span className="text-ink-soft text-xs font-medium">Header</span>
            <input
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              className="border-ink/15 text-ink font-display mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-lg font-semibold focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-ink-soft text-xs font-medium">Story</span>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={4}
              className="border-ink/15 text-ink mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none"
            />
          </label>

          <div className="flex gap-4">
            <label className="block flex-1">
              <span className="text-ink-soft text-xs font-medium">Place</span>
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="Jaipur"
                className="border-ink/15 text-ink mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
              />
            </label>
            <label className="block flex-1">
              <span className="text-ink-soft text-xs font-medium">Country</span>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="border-ink/15 text-ink mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
              />
            </label>
          </div>

          <div className="block">
            <span className="text-ink-soft text-xs font-medium">
              Google Drive folders
            </span>
            <div className="mt-1.5 flex flex-col gap-3">
              {driveFolderInputs.map((input, i) => {
                const check: DriveCheckState = driveChecks[i] ?? { status: "idle" };
                return (
                  <div key={i}>
                    <div className="flex gap-2">
                      <input
                        value={input}
                        onChange={(e) => updateFolderInput(i, e.target.value)}
                        placeholder="Paste a Drive folder link"
                        className="border-ink/15 text-ink w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
                      />
                      {driveFolderInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFolderRow(i)}
                          title="Remove folder"
                          className="text-ink-soft hover:text-stamp shrink-0 px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {check.status === "checking" && (
                      <p className="text-ink-soft mt-1 text-xs">Checking access…</p>
                    )}
                    {check.status === "ok" && (
                      <p className="text-teal mt-1 text-xs">✓ Connected to “{check.name}”</p>
                    )}
                    {check.status === "error" && (
                      <p className="text-stamp mt-1 text-xs">{check.message}</p>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addFolderRow}
                className="text-teal self-start text-sm font-medium"
              >
                + Add another folder
              </button>
            </div>
          </div>

          <div>
            <span className="text-ink-soft text-xs font-medium">Show images</span>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="imageFilter"
                  checked={imageFilter === "all"}
                  onChange={() => setImageFilter("all")}
                />
                All photos in folder
              </label>
              {imageFilter === "all" && (
                <div className="ml-6 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={randomizeAll}
                      onChange={(e) => setRandomizeAll(e.target.checked)}
                    />
                    Randomize — pick a fresh random set each time, limit:
                    <input
                      type="number"
                      min={1}
                      value={randomLimit}
                      onChange={(e) => setRandomLimit(Math.max(1, Number(e.target.value) || 1))}
                      disabled={!randomizeAll}
                      className="border-ink/15 ml-1 w-16 rounded border bg-white px-2 py-1 text-sm disabled:opacity-40"
                    />
                  </label>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="imageFilter"
                  checked={imageFilter === "tagged"}
                  onChange={() => setImageFilter("tagged")}
                />
                Tagged — keyword:
                <input
                  value={tagKeyword}
                  onChange={(e) => setTagKeyword(e.target.value)}
                  disabled={imageFilter !== "tagged"}
                  className="border-ink/15 ml-1 w-28 rounded border bg-white px-2 py-1 text-sm disabled:opacity-40"
                />
              </label>
            </div>
          </div>

          <div>
            <span className="text-ink-soft text-xs font-medium">Display as</span>
            <div className="mt-2 flex items-center gap-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="displayMode"
                  checked={displayMode === "grid"}
                  onChange={() => setDisplayMode("grid")}
                />
                Grid
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="displayMode"
                  checked={displayMode === "slideshow"}
                  onChange={() => setDisplayMode("slideshow")}
                />
                Slideshow
              </label>
              {displayMode === "slideshow" && (
                <label className="flex items-center gap-2 text-sm">
                  Time lapse:
                  <input
                    type="number"
                    min={1}
                    value={slideshowIntervalSec}
                    onChange={(e) =>
                      setSlideshowIntervalSec(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="border-ink/15 w-16 rounded border bg-white px-2 py-1 text-sm"
                  />
                  sec
                </label>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-teal rounded-full py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save page"}
          </button>

          {nfcSlug ? (
            <div className="border-ink/10 rounded-card border-t pt-5">
              <span className="text-ink-soft text-xs font-medium">NFC link</span>
              <p className="font-meta-label text-ink mt-1.5 truncate text-sm">
                {host}/p/{nfcSlug}
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="border-teal text-teal mt-3 rounded-full border px-4 py-1.5 text-sm font-medium"
              >
                Copy link
              </button>
            </div>
          ) : (
            <p className="text-ink-soft border-ink/10 border-t pt-5 text-xs">
              Save this page to generate its NFC link.
            </p>
          )}
        </div>
      </div>

      {toast && (
        <div className="bg-ink font-meta-label fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
