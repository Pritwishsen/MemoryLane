"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import AccountBadge from "./AccountBadge";
import { countryToIso2 } from "@/lib/countries";
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
  /** Set server-side (see page.tsx) when the host's OWN token is already
   *  known to be bad before any Drive call is even attempted — e.g. it
   *  doesn't carry the drive.readonly scope (see authOptions.ts's jwt
   *  callback). Shown as a banner up front rather than waiting for the
   *  per-folder check below to fail with Google's raw error text. */
  sessionError?: "RefreshAccessTokenError" | "InsufficientScopeError";
};

type DriveCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; name: string }
  | {
      status: "error";
      message: string;
      reason?: "not-shared" | "insufficient-scope" | "unknown";
    };

// GUEST_SCREENS.md option 5a's tile picker copy, verbatim.
const DISPLAY_MODE_META: { mode: DisplayMode; name: string; hint: string }[] = [
  { mode: "grid", name: "Grid", hint: "Two columns, tap to enlarge" },
  { mode: "slideshow", name: "Slideshow", hint: "Auto-advances, tap sides to steer" },
  { mode: "contact", name: "Contact sheet", hint: "Swipe sideways · best over 15 photos" },
  { mode: "stack", name: "Stack", hint: "One print at a time · best under 10" },
  { mode: "scrapbook", name: "Scrapbook", hint: "Mixed sizes, taped down" },
  { mode: "gallery", name: "Gallery", hint: "Big photo with a thumbnail rail" },
];

const DIAGRAM_BLOCK = "#C9C0A9";

/** A 54px-tall static mini layout diagram per display mode — plain divs on
 *  --color-paper, per GUEST_SCREENS.md option 5a. Purely decorative, so
 *  approximate shapes rather than literal miniatures of the real components. */
function DisplayModeDiagram({ mode }: { mode: DisplayMode }) {
  const base = "h-[54px] w-full overflow-hidden rounded-[4px]";

  if (mode === "grid") {
    return (
      <div className={`${base} grid grid-cols-2 gap-1 p-1.5`} style={{ background: "var(--color-paper)" }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="rounded-[2px]" style={{ background: DIAGRAM_BLOCK }} />
        ))}
      </div>
    );
  }
  if (mode === "slideshow") {
    return (
      <div
        className={`${base} flex flex-col items-center justify-center gap-1.5`}
        style={{ background: "var(--color-paper)" }}
      >
        <span className="h-8 w-10/12 rounded-[2px]" style={{ background: DIAGRAM_BLOCK }} />
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full"
              style={{ background: i === 0 ? "var(--color-teal)" : DIAGRAM_BLOCK }}
            />
          ))}
        </span>
      </div>
    );
  }
  if (mode === "contact") {
    return (
      <div className={`${base} flex items-center gap-1 px-1.5`} style={{ background: "var(--color-ink)" }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-8 w-3 shrink-0 rounded-[1px]"
            style={{ background: "rgba(243,237,228,.5)" }}
          />
        ))}
      </div>
    );
  }
  if (mode === "stack") {
    return (
      <div className={`${base} relative`} style={{ background: "var(--color-paper)" }}>
        <span
          className="absolute rounded-[2px]"
          style={{ left: 22, top: 10, width: 22, height: 34, background: "#E2DAC6", transform: "rotate(6deg)" }}
        />
        <span
          className="absolute rounded-[2px]"
          style={{ left: 18, top: 8, width: 22, height: 34, background: "#D8CFB8", transform: "rotate(-3deg)" }}
        />
        <span
          className="absolute rounded-[2px]"
          style={{ left: 16, top: 6, width: 22, height: 34, background: DIAGRAM_BLOCK }}
        />
      </div>
    );
  }
  if (mode === "scrapbook") {
    return (
      <div className={`${base} grid grid-cols-2 gap-1 p-1.5`} style={{ background: "var(--color-paper)" }}>
        <span className="col-span-2 h-3 rounded-[2px]" style={{ background: DIAGRAM_BLOCK }} />
        <span className="h-5 rounded-[2px]" style={{ background: DIAGRAM_BLOCK, transform: "rotate(-2deg)" }} />
        <span className="h-5 rounded-[2px]" style={{ background: DIAGRAM_BLOCK, transform: "rotate(2deg)" }} />
      </div>
    );
  }
  // gallery
  return (
    <div className={`${base} flex flex-col gap-1 p-1.5`} style={{ background: "var(--color-paper)" }}>
      <span className="h-8 w-full rounded-[2px]" style={{ background: DIAGRAM_BLOCK }} />
      <span className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-[1px]"
            style={{ background: i === 0 ? "var(--color-brass)" : DIAGRAM_BLOCK }}
          />
        ))}
      </span>
    </div>
  );
}

export default function PageEditorClient({
  albumId,
  page,
  host,
  userName,
  userImage,
  userEmail,
  sessionError,
}: PageEditorClientProps) {
  const [header, setHeader] = useState(page.header);
  const [bodyText, setBodyText] = useState(page.bodyText);
  const [place, setPlace] = useState(page.place ?? "");
  const [country, setCountry] = useState(page.country ?? "");
  // Reflects the last SAVED place/country, not whatever's currently typed —
  // geocoding only runs server-side on save (Nominatim's usage policy asks
  // callers not to hammer it on every keystroke), so this can only ever be
  // as fresh as the last save. Country-recognition below has no such cost
  // and can react live to typing instead.
  const [lat, setLat] = useState(page.lat);
  const [lng, setLng] = useState(page.lng);
  // The exact place/country text that produced the lat/lng above, so the
  // "couldn't place it" warning only shows while the fields still match what
  // was actually geocoded — not the instant a fresh/edited page has null
  // lat/lng before any save has even been attempted.
  const [geocodedPlace, setGeocodedPlace] = useState(page.place ?? "");
  const [geocodedCountry, setGeocodedCountry] = useState(page.country ?? "");
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
      const results: Array<{
        folderId: string;
        ok: boolean;
        name?: string;
        error?: string;
        reason?: "not-shared" | "insufficient-scope" | "unknown";
      }> = data.results ?? [];
      setDriveChecks(
        folderIds.map((id) => {
          const match = results.find((r) => r.folderId === id);
          if (!match) return { status: "error", message: "No result" };
          return match.ok
            ? { status: "ok", name: match.name ?? "" }
            : {
                status: "error",
                message: match.error ?? "Couldn't access this folder",
                reason: match.reason,
              };
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
    const placeAtSave = place;
    const countryAtSave = country;
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
      setLat(updated.lat);
      setLng(updated.lng);
      setGeocodedPlace(placeAtSave);
      setGeocodedCountry(countryAtSave);
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

  // Live — pure string lookup, no network call, safe to recompute on every keystroke.
  const flagUnrecognized = country.trim() !== "" && !countryToIso2(country);
  // Reflects the saved page (see the lat/lng state comment above): true once a place
  // or country has actually been saved and Nominatim still couldn't place it. Only
  // shown while the fields still match what was saved — editing them again hides it
  // until the next save, rather than warning about text that was never geocoded.
  const pinMissing =
    (geocodedPlace.trim() !== "" || geocodedCountry.trim() !== "") &&
    (lat == null || lng == null) &&
    place === geocodedPlace &&
    country === geocodedCountry;

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

        {sessionError && (
          <div className="border-stamp/30 bg-stamp/5 mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <p className="text-stamp text-xs">
              {sessionError === "InsufficientScopeError"
                ? "Your Google sign-in doesn't have Drive access yet — reconnect to add or check folders."
                : "Your Google sign-in needs refreshing to keep working."}
            </p>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/create" })}
              className="text-stamp shrink-0 text-xs font-medium underline"
            >
              Sign out &amp; reconnect
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-6">
          <label className="block">
            <span className="text-ink-soft text-xs font-medium">Header</span>
            <input
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              className="border-ink/15 text-ink font-display mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-lg font-semibold focus:outline-none"
              suppressHydrationWarning
            />
          </label>

          <label className="block">
            <span className="text-ink-soft text-xs font-medium">Story</span>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={4}
              className="border-ink/15 text-ink mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none"
              suppressHydrationWarning
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
                suppressHydrationWarning
              />
            </label>
            <label className="block flex-1">
              <span className="text-ink-soft text-xs font-medium">Country</span>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="border-ink/15 text-ink mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
                suppressHydrationWarning
              />
            </label>
          </div>

          {(pinMissing || flagUnrecognized) && (
            <p className="text-stamp bg-stamp/5 rounded-lg p-3 text-xs leading-relaxed">
              {pinMissing && (
                <>
                  ⚠ We couldn&rsquo;t place &ldquo;{[place, country].filter(Boolean).join(", ")}
                  &rdquo; on the map, so this page won&rsquo;t get a pin yet — try being more
                  specific (a nearby city, or the full country name).
                </>
              )}
              {pinMissing && flagUnrecognized && <br />}
              {flagUnrecognized && (
                <>
                  ⚠ &ldquo;{country}&rdquo; isn&rsquo;t a country name we recognize, so no flag
                  will show for it{pinMissing ? "" : " on the map"}.
                </>
              )}
            </p>
          )}

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
                        suppressHydrationWarning
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
                      <p className="text-stamp mt-1 text-xs">
                        {check.message}
                        {check.reason === "insufficient-scope" && (
                          <>
                            {" "}
                            <button
                              type="button"
                              onClick={() => signOut({ callbackUrl: "/create" })}
                              className="underline"
                            >
                              Sign out &amp; reconnect
                            </button>
                          </>
                        )}
                      </p>
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
                  suppressHydrationWarning
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
                      suppressHydrationWarning
                    />
                    Randomize — pick a fresh random set each time, limit:
                    <input
                      type="number"
                      min={1}
                      value={randomLimit}
                      onChange={(e) => setRandomLimit(Math.max(1, Number(e.target.value) || 1))}
                      disabled={!randomizeAll}
                      className="border-ink/15 ml-1 w-16 rounded border bg-white px-2 py-1 text-sm disabled:opacity-40"
                      suppressHydrationWarning
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
                  suppressHydrationWarning
                />
                Tagged — keyword:
                <input
                  value={tagKeyword}
                  onChange={(e) => setTagKeyword(e.target.value)}
                  disabled={imageFilter !== "tagged"}
                  className="border-ink/15 ml-1 w-28 rounded border bg-white px-2 py-1 text-sm disabled:opacity-40"
                  suppressHydrationWarning
                />
              </label>
            </div>
          </div>

          <div>
            <span className="text-ink-soft text-xs font-medium">Display as</span>
            <div className="mt-2 grid grid-cols-2 gap-3 min-[560px]:grid-cols-3">
              {DISPLAY_MODE_META.map(({ mode, name, hint }) => {
                const selected = displayMode === mode;
                return (
                  <label
                    key={mode}
                    className="cursor-pointer rounded-lg bg-white p-3"
                    style={{
                      border: selected ? "2px solid var(--color-teal)" : "2px solid rgba(34,32,27,.15)",
                      boxShadow: selected ? "0 2px 6px rgba(31,78,74,.14)" : undefined,
                    }}
                  >
                    <DisplayModeDiagram mode={mode} />
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="radio"
                        name="displayMode"
                        checked={selected}
                        onChange={() => setDisplayMode(mode)}
                        className="h-[13px] w-[13px] shrink-0 appearance-none rounded-full bg-white"
                        style={{
                          border: selected ? "4px solid var(--color-teal)" : "1.5px solid rgba(34,32,27,.35)",
                        }}
                        suppressHydrationWarning
                      />
                      <span className={`text-ink text-[13px] ${selected ? "font-semibold" : "font-medium"}`}>
                        {name}
                      </span>
                    </div>
                    <p className="text-ink-soft mt-1 text-[11.5px]">{hint}</p>
                  </label>
                );
              })}
            </div>

            {(displayMode === "slideshow" || displayMode === "gallery") && (
              <div
                className="mt-3 flex items-center gap-2 rounded-lg text-sm"
                style={{
                  background: "rgba(31,78,74,.06)",
                  border: "1px solid rgba(31,78,74,.18)",
                  padding: "12px 14px",
                }}
              >
                Time lapse:
                <input
                  type="number"
                  min={1}
                  value={slideshowIntervalSec}
                  onChange={(e) =>
                    setSlideshowIntervalSec(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="border-ink/15 w-16 rounded border bg-white px-2 py-1 text-sm"
                  suppressHydrationWarning
                />
                sec
              </div>
            )}
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
