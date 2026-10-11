"use client";
/* eslint-disable @next/next/no-img-element -- small Drive thumbnails in the
   folder card; next/image adds nothing at 44px. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { backLinkClass, buttonClass } from "@/components/ui/styles";
import Toast, { useToast } from "@/components/ui/Toast";
import Dialog from "@/components/ui/Dialog";
import AccountBadge from "./AccountBadge";
import DriveFolderPicker from "./DriveFolderPicker";
import { DisplayModeDiagram, DisplayModePreview, PREVIEW_NOTE } from "./DisplayModeVisuals";
import { countryToIso2 } from "@/lib/countries";
import { parseDriveFolderId } from "@/lib/drive";
import { HOST_AUTH_PARAMS } from "@/lib/scopes";
import {
  DISPLAY_MODES,
  DISPLAY_MODE_HINT,
  DISPLAY_MODE_NAME,
  TIMED_MODES,
  suggestedModes,
} from "@/lib/displayModes";
import type { DisplayMode, Page } from "@/types/models";

type PageEditorClientProps = {
  albumId: string;
  page: Page;
  /** Read server-side from the request's Host header (see page.tsx) rather
   *  than window.location client-side, so the page link renders identically
   *  on the server and on hydration — no mismatch. */
  host: string;
  userName: string | null;
  userImage: string | null;
  userEmail: string | null;
  /** Set server-side when the host's own token is already known to be bad,
   *  so the banner shows up front instead of after a Drive call fails. */
  sessionError?: "RefreshAccessTokenError" | "InsufficientScopeError";
};

type DriveFile = { id: string; name: string; thumb: string | null; desc?: string };

type FolderState =
  | { id: string; status: "checking" }
  | { id: string; status: "ok"; name: string; files: DriveFile[] | null }
  | { id: string; status: "error"; message: string; reason?: "not-shared" | "insufficient-scope" | "unknown" };

type PhotoMode = "all" | "sel";
type SelMode = "rnd" | "tag";

const STRIPES = "repeating-linear-gradient(135deg,#ded5c0 0 6px,#d4cab3 6px 12px)";
const SECTIONS = ["Story", "Photos", "Display", "Link"] as const;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const inputClass =
  "border-ink/15 text-ink mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none";

/** Asks the server about each folder: reachable? name? which images? */
async function fetchFolderStates(albumId: string, pageId: string, ids: string[]): Promise<FolderState[]> {
  try {
    const res = await fetch(
      `/api/albums/${albumId}/pages/${pageId}/drive-check?folderIds=${encodeURIComponent(ids.join(","))}`
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Couldn't reach Google Drive");
    const results: Array<{
      folderId: string;
      ok: boolean;
      name?: string;
      error?: string;
      reason?: "not-shared" | "insufficient-scope" | "unknown";
      files?: DriveFile[];
    }> = data.results ?? [];
    return ids.map((id): FolderState => {
      const r = results.find((x) => x.folderId === id);
      if (!r) return { id, status: "error", message: "No answer from Google Drive" };
      return r.ok
        ? { id, status: "ok", name: r.name ?? "", files: r.files ?? null }
        : {
            id,
            status: "error",
            message:
              r.reason === "not-shared"
                ? "This folder isn't in your Drive, or isn't shared with you"
                : (r.error ?? "Couldn't access this folder"),
            reason: r.reason,
          };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't reach Google Drive";
    return ids.map((id) => ({ id, status: "error" as const, message }));
  }
}

/** Applies fresh check results to the folder list, skipping any folder the
 *  host removed while the check was in flight. */
function mergeFolderStates(prev: FolderState[], fresh: FolderState[]): FolderState[] {
  return prev.map((f) => fresh.find((x) => x.id === f.id) ?? f);
}

function SectionCard({
  id,
  n,
  title,
  sub,
  children,
}: {
  id: string;
  n: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`pe-${id}`}
      className="border-ink/10 flex scroll-mt-4 flex-col gap-5 rounded-xl border bg-white/55 p-5"
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="font-meta text-gold text-xs tracking-[0.06em]">{n}</span>
        <h2 className="font-display text-ink text-xl font-semibold">{title}</h2>
        <span className="text-ink-soft text-[13px]">{sub}</span>
      </div>
      {children}
    </section>
  );
}

function Radio({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex min-h-11 items-center gap-2.5 text-left"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 rounded-full bg-white"
        style={{ border: checked ? "5px solid var(--color-teal)" : "1.5px solid rgba(34,32,27,.4)" }}
      />
      <span className="text-ink text-sm">{children}</span>
    </button>
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
  const router = useRouter();
  const albumHref = `/dashboard/${albumId}`;

  const [header, setHeader] = useState(page.header);
  const [bodyText, setBodyText] = useState(page.bodyText);
  const [place, setPlace] = useState(page.place ?? "");
  const [country, setCountry] = useState(page.country ?? "");
  // lat/lng reflect the last SAVED place/country: geocoding only runs
  // server-side on save (Nominatim's usage policy asks callers not to hit it
  // per keystroke). geocodedPlace/Country remember which text produced them.
  const [lat, setLat] = useState(page.lat);
  const [lng, setLng] = useState(page.lng);
  const [geocodedPlace, setGeocodedPlace] = useState(page.place ?? "");
  const [geocodedCountry, setGeocodedCountry] = useState(page.country ?? "");

  const [folders, setFolders] = useState<FolderState[]>(() =>
    (page.driveFolderIds ?? []).map((id) => ({ id, status: "checking" as const }))
  );
  const [photoMode, setPhotoMode] = useState<PhotoMode>(
    page.imageFilter === "tagged" || page.randomizeAll ? "sel" : "all"
  );
  const [selMode, setSelMode] = useState<SelMode>(page.imageFilter === "tagged" ? "tag" : "rnd");
  const [tagKeyword, setTagKeyword] = useState(page.tagKeyword);
  const [randomLimit, setRandomLimit] = useState(page.randomLimit ?? 20);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(page.displayMode);
  const [intervalSec, setIntervalSec] = useState(page.slideshowIntervalSec ?? 4);

  const [nfcSlug, setNfcSlug] = useState(page.nfcSlug);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useToast();
  const [picker, setPicker] = useState<null | { mode: "add" } | { mode: "change"; index: number }>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // What the server has. Used to detect unsaved changes for Cancel.
  const snapshot = (v: {
    header: string;
    bodyText: string;
    place: string;
    country: string;
    folderIds: string[];
    imageFilter: string;
    tagKeyword: string;
    randomizeAll: boolean;
    randomLimit: number;
    displayMode: string;
    intervalSec: number;
  }) => JSON.stringify(v);
  const fields = {
    header,
    bodyText,
    place,
    country,
    folderIds: folders.map((f) => f.id),
    imageFilter: photoMode === "sel" && selMode === "tag" ? "tagged" : "all",
    tagKeyword,
    randomizeAll: photoMode === "sel" && selMode === "rnd",
    randomLimit,
    displayMode,
    intervalSec,
  };
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshot({
      header: page.header,
      bodyText: page.bodyText,
      place: page.place ?? "",
      country: page.country ?? "",
      folderIds: page.driveFolderIds ?? [],
      imageFilter: page.imageFilter === "tagged" ? "tagged" : "all",
      tagKeyword: page.tagKeyword,
      randomizeAll: page.imageFilter !== "tagged" && !!page.randomizeAll,
      randomLimit: page.randomLimit ?? 20,
      displayMode: page.displayMode,
      intervalSec: page.slideshowIntervalSec ?? 4,
    })
  );
  const dirty = snapshot(fields) !== savedSnapshot;

  useEffect(() => {
    // Check the folders this page already had saved, once, on open.
    const ids = page.driveFolderIds ?? [];
    if (ids.length === 0) return;
    let cancelled = false;
    fetchFolderStates(albumId, page.id, ids).then((states) => {
      if (!cancelled) setFolders((prev) => mergeFolderStates(prev, states));
    });
    return () => {
      cancelled = true;
    };
  }, [albumId, page.id, page.driveFolderIds]);

  function checkFolders(ids: string[]) {
    fetchFolderStates(albumId, page.id, ids).then((states) => setFolders((prev) => mergeFolderStates(prev, states)));
  }

  function addFolder(id: string, replaceIndex?: number) {
    if (folders.some((f, i) => f.id === id && i !== replaceIndex)) {
      setToast("That folder is already on this page");
      return;
    }
    const next: FolderState = { id, status: "checking" };
    setFolders((prev) =>
      replaceIndex === undefined ? [...prev, next] : prev.map((f, i) => (i === replaceIndex ? next : f))
    );
    checkFolders([id]);
  }

  function handlePaste() {
    const id = parseDriveFolderId(pasteValue);
    if (!id) {
      setPasteError("That doesn't look like a Drive folder link");
      return;
    }
    addFolder(id);
    setPasteValue("");
    setPasteError(null);
    setPasteOpen(false);
  }

  // Photo maths for counts, suggestions and preview: unknown (null) while
  // any folder is still being checked or Drive didn't return its files.
  // Folders that errored contribute nothing.
  const allFiles = useMemo(() => {
    if (folders.some((f) => f.status === "checking" || (f.status === "ok" && f.files === null))) return null;
    const seen = new Set<string>();
    const out: DriveFile[] = [];
    for (const f of folders) {
      if (f.status !== "ok" || !f.files) continue;
      for (const file of f.files) {
        if (seen.has(file.id)) continue;
        seen.add(file.id);
        out.push(file);
      }
    }
    return out;
  }, [folders]);

  const keyword = tagKeyword.trim().toLowerCase();
  const shownFiles = useMemo(() => {
    if (!allFiles) return null;
    if (photoMode === "sel" && selMode === "tag" && keyword) {
      return allFiles.filter((f) => f.desc?.toLowerCase().includes(keyword));
    }
    return allFiles;
  }, [allFiles, photoMode, selMode, keyword]);
  const totalCount = folders.length === 0 ? null : (allFiles?.length ?? null);
  const effectiveCount =
    shownFiles === null
      ? null
      : photoMode === "sel" && selMode === "rnd"
        ? Math.min(randomLimit, shownFiles.length)
        : shownFiles.length;
  const suggestions = effectiveCount === null ? [] : suggestedModes(effectiveCount);
  const previewThumbs = (shownFiles ?? []).map((f) => f.thumb).filter((x): x is string => Boolean(x)).slice(0, 8);

  // Live — pure string lookup, no network call.
  const flagUnrecognized = country.trim() !== "" && !countryToIso2(country);
  const pinMissing =
    (geocodedPlace.trim() !== "" || geocodedCountry.trim() !== "") &&
    (lat == null || lng == null) &&
    place === geocodedPlace &&
    country === geocodedCountry;

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
          driveFolderInputs: fields.folderIds,
          imageFilter: fields.imageFilter,
          tagKeyword,
          randomizeAll: fields.randomizeAll,
          randomLimit,
          displayMode,
          slideshowIntervalSec: intervalSec,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save");
      }
      const { page: updated } = (await res.json()) as { page: Page };
      setHeader(updated.header);
      setNfcSlug(updated.nfcSlug);
      setLat(updated.lat);
      setLng(updated.lng);
      setGeocodedPlace(place);
      setGeocodedCountry(country);
      setSavedSnapshot(snapshot({ ...fields, header: updated.header }));

      const unplaced = (place.trim() || country.trim()) && (updated.lat == null || updated.lng == null);
      if (unplaced) {
        // Stay so the host sees the "couldn't place it on the map" warning.
        setToast("Saved — but this place isn't on the map yet");
      } else {
        router.push(albumHref);
        router.refresh();
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (dirty) setConfirmDiscard(true);
    else router.push(albumHref);
  }

  function scrollTo(section: string) {
    document.getElementById(`pe-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCopyLink() {
    navigator.clipboard
      .writeText(`${window.location.origin}/p/${nfcSlug}`)
      .then(() => setToast("Link copied — write it to your NFC tag"))
      .catch(() => setToast("Couldn't copy the link"));
  }

  const reconnect = () => signIn("google", { callbackUrl: window.location.href }, HOST_AUTH_PARAMS);

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex-1 px-5 pb-8 pt-6 sm:px-8">
        <div className="mx-auto w-full max-w-[720px]">
          <div className="flex items-center justify-between">
            <button type="button" onClick={handleCancel} className={backLinkClass}>
              ← Back to album
            </button>
            <AccountBadge name={userName} image={userImage} email={userEmail} />
          </div>

          <h1 className="font-display text-ink mt-4 text-[26px] font-semibold">Edit page</h1>

          {sessionError && (
            <div className="border-stamp/30 bg-stamp/5 mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <p className="text-stamp text-xs">
                {sessionError === "InsufficientScopeError"
                  ? "Your Google sign-in doesn't have Drive access yet — reconnect to add or check folders."
                  : "Your Google sign-in needs refreshing to keep working."}
              </p>
              <button type="button" onClick={reconnect} className="text-stamp min-h-11 shrink-0 text-xs font-medium underline">
                Reconnect
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => scrollTo(s)}
                className="border-ink/15 text-teal min-h-9 rounded-full border bg-white px-4 text-[13px] font-medium"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-5">
            <SectionCard id="Story" n="01" title="Story" sub="What guests read">
              <label className="block">
                <span className="text-ink-soft text-xs font-medium">Header</span>
                <input
                  value={header}
                  onChange={(e) => setHeader(e.target.value)}
                  className={`${inputClass} font-display text-lg font-semibold`}
                  suppressHydrationWarning
                />
              </label>
              <label className="block">
                <span className="text-ink-soft text-xs font-medium">Story</span>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={4}
                  className={`${inputClass} min-h-24 leading-relaxed`}
                  suppressHydrationWarning
                />
              </label>
              <div className="flex gap-4">
                <label className="block min-w-0 flex-1">
                  <span className="text-ink-soft text-xs font-medium">Place</span>
                  <input
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="Jaipur"
                    className={inputClass}
                    suppressHydrationWarning
                  />
                </label>
                <label className="block min-w-0 flex-1">
                  <span className="text-ink-soft text-xs font-medium">Country</span>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="India"
                    className={inputClass}
                    suppressHydrationWarning
                  />
                </label>
              </div>
              {(pinMissing || flagUnrecognized) && (
                <p className="text-stamp bg-stamp/5 rounded-lg p-3 text-xs leading-relaxed">
                  {pinMissing && (
                    <>
                      ⚠ We couldn&rsquo;t place &ldquo;{[place, country].filter(Boolean).join(", ")}&rdquo; on the
                      map, so this page won&rsquo;t get a pin yet — try being more specific (a nearby city, or the
                      full country name).
                    </>
                  )}
                  {pinMissing && flagUnrecognized && <br />}
                  {flagUnrecognized && (
                    <>
                      ⚠ &ldquo;{country}&rdquo; isn&rsquo;t a country name we recognize, so no flag will show for it
                      {pinMissing ? "" : " on the map"}.
                    </>
                  )}
                </p>
              )}
            </SectionCard>

            <SectionCard id="Photos" n="02" title="Photos" sub="Where they come from">
              <div>
                <span className="text-ink-soft text-xs font-medium">
                  Google Drive folder{folders.length > 1 ? "s" : ""}
                </span>
                <div className="mt-1.5 flex flex-col gap-2">
                  {folders.length === 0 && (
                    <div className="border-ink/15 flex flex-wrap items-center gap-3 rounded-[10px] border border-dashed bg-white p-3">
                      <div className="min-w-[140px] flex-1">
                        <div className="text-ink text-sm font-semibold">No Drive folder yet</div>
                        <div className="text-ink-soft text-xs">Guests see this page&rsquo;s photos from a folder you pick.</div>
                      </div>
                      <button type="button" onClick={() => setPicker({ mode: "add" })} className={buttonClass("primary", "sm")}>
                        Choose a folder
                      </button>
                    </div>
                  )}
                  {folders.map((f, i) => {
                    const thumbs = f.status === "ok" ? (f.files ?? []).map((x) => x.thumb).filter(Boolean).slice(0, 3) : [];
                    return (
                      <div
                        key={f.id}
                        className={`flex flex-wrap items-center gap-3 rounded-[10px] border bg-white p-3 ${
                          f.status === "error" ? "border-stamp/40" : "border-ink/15"
                        }`}
                      >
                        <div className="flex shrink-0 gap-[3px]">
                          {[0, 1, 2].map((k) =>
                            thumbs[k] ? (
                              <span key={k} className="h-11 w-11 overflow-hidden rounded" style={{ background: STRIPES }}>
                                <img
                                  src={thumbs[k] as string}
                                  alt=""
                                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                                  className="h-full w-full object-cover"
                                />
                              </span>
                            ) : (
                              <span key={k} className="h-11 w-11 rounded" style={{ background: STRIPES }} />
                            )
                          )}
                        </div>
                        <div className="min-w-[140px] flex-1">
                          {f.status === "checking" && (
                            <>
                              <div className="text-ink text-sm font-semibold">Checking folder…</div>
                              <div className="text-ink-soft text-xs">Looking it up in Google Drive</div>
                            </>
                          )}
                          {f.status === "ok" && (
                            <>
                              <div className="text-ink truncate text-sm font-semibold">{f.name}</div>
                              <div className="text-teal text-xs">
                                ✓ {f.files ? `${plural(f.files.length, "photo")} found · ` : ""}Connected
                              </div>
                            </>
                          )}
                          {f.status === "error" && (
                            <>
                              <div className="text-ink text-sm font-semibold">Can&rsquo;t open this folder</div>
                              <div className="text-stamp text-xs">
                                {f.message}
                                {f.reason === "insufficient-scope" && (
                                  <>
                                    {" "}
                                    <button type="button" onClick={reconnect} className="underline">
                                      Reconnect
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPicker({ mode: "change", index: i })}
                            className={buttonClass("secondary", "sm")}
                          >
                            Change folder
                          </button>
                          <button
                            type="button"
                            onClick={() => setFolders((prev) => prev.filter((_, j) => j !== i))}
                            aria-label="Remove folder"
                            className="text-ink-soft hover:text-stamp flex h-11 w-9 items-center justify-center"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-[13px] font-medium">
                  {folders.length > 0 && (
                    <button type="button" onClick={() => setPicker({ mode: "add" })} className="text-teal min-h-11">
                      + Add another folder from Drive
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPasteOpen((v) => !v)}
                    className="text-ink-soft hover:text-teal min-h-11"
                  >
                    or paste a link
                  </button>
                </div>
                {pasteOpen && (
                  <div className="mt-1">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={pasteValue}
                        onChange={(e) => setPasteValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePaste()}
                        placeholder="https://drive.google.com/drive/folders/…"
                        className={`${inputClass} mt-0`}
                      />
                      <button type="button" onClick={handlePaste} className={buttonClass("secondary", "md", "shrink-0")}>
                        Add
                      </button>
                    </div>
                    {pasteError && <p className="text-stamp mt-1 text-xs">{pasteError}</p>}
                  </div>
                )}
              </div>

              <div role="radiogroup" aria-label="Which photos to show">
                <span className="text-ink-soft text-xs font-medium">Which photos to show</span>
                <div className="mt-1 flex flex-col">
                  <Radio checked={photoMode === "all"} onSelect={() => setPhotoMode("all")}>
                    {totalCount === null ? "All photos in the folder" : `All ${plural(totalCount, "photo")} in the folder${folders.length > 1 ? "s" : ""}`}
                  </Radio>
                  <Radio checked={photoMode === "sel"} onSelect={() => setPhotoMode("sel")}>
                    A selection of photos
                  </Radio>
                  {photoMode === "sel" && (
                    <div className="border-teal/25 my-1 ml-2 flex flex-col border-l-2 py-1 pl-[18px]">
                      <Radio checked={selMode === "rnd"} onSelect={() => setSelMode("rnd")}>
                        Random set, a fresh one each time
                      </Radio>
                      {selMode === "rnd" && (
                        <label className="text-ink-soft ml-[26px] flex items-center gap-2 pb-1.5 text-[13px]">
                          Limit to
                          <input
                            type="number"
                            min={1}
                            value={randomLimit}
                            onChange={(e) => setRandomLimit(Math.max(1, Number(e.target.value) || 1))}
                            className="border-ink/15 text-ink min-h-9 w-16 rounded-md border bg-white px-2.5 py-1.5"
                            suppressHydrationWarning
                          />
                          photos
                        </label>
                      )}
                      <Radio checked={selMode === "tag"} onSelect={() => setSelMode("tag")}>
                        Only photos with a keyword
                      </Radio>
                      {selMode === "tag" && (
                        <label className="text-ink-soft ml-[26px] flex flex-wrap items-center gap-2 pb-1.5 text-[13px]">
                          Keyword
                          <input
                            value={tagKeyword}
                            onChange={(e) => setTagKeyword(e.target.value)}
                            placeholder="e.g. best"
                            className="border-ink/15 text-ink min-h-9 w-36 rounded-md border bg-white px-2.5 py-1.5"
                            suppressHydrationWarning
                          />
                          {shownFiles && keyword && (
                            <span className="text-ink-soft text-xs">
                              {plural(shownFiles.length, "match")}
                            </span>
                          )}
                        </label>
                      )}
                      {selMode === "tag" && (
                        <p className="text-ink-soft ml-[26px] text-xs">
                          Matches words in each photo&rsquo;s description in Google Drive.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard id="Display" n="03" title="Display" sub="How guests see them">
              <div>
                <span className="text-ink-soft text-xs font-medium">Display as</span>
                {effectiveCount !== null && effectiveCount > 0 && (
                  <p className="text-teal bg-teal/[0.07] mt-1.5 rounded-lg px-3 py-2 text-[13px] leading-normal">
                    Guests will see {plural(effectiveCount, "photo")}. Suggested layouts are marked.
                  </p>
                )}
                <div
                  role="radiogroup"
                  aria-label="Display as"
                  className="mt-2 grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill,minmax(max(140px,calc((100% - 24px) / 3)),1fr))" }}
                >
                  {DISPLAY_MODES.map((mode) => {
                    const selected = displayMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setDisplayMode(mode)}
                        className="rounded-lg bg-white p-3 text-left"
                        style={{
                          border: selected ? "2px solid var(--color-teal)" : "2px solid rgba(34,32,27,.15)",
                          boxShadow: selected ? "0 2px 6px rgba(31,78,74,.14)" : undefined,
                        }}
                      >
                        <DisplayModeDiagram mode={mode} />
                        <span className="mt-2.5 flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-[13px] w-[13px] shrink-0 rounded-full bg-white"
                            style={{ border: selected ? "4px solid var(--color-teal)" : "1.5px solid rgba(34,32,27,.35)" }}
                          />
                          <span className={`text-ink text-[13px] ${selected ? "font-semibold" : "font-medium"}`}>
                            {DISPLAY_MODE_NAME[mode]}
                          </span>
                        </span>
                        <span className="text-ink-soft mt-1 block text-[11.5px] leading-snug">{DISPLAY_MODE_HINT[mode]}</span>
                        {suggestions.includes(mode) && (
                          <span className="font-meta-label text-gold border-brass mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px]">
                            Suggested
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {TIMED_MODES.includes(displayMode) && (
                  <label className="bg-teal/[0.06] border-teal/20 mt-3 flex items-center gap-2 rounded-lg border px-3.5 py-3 text-sm">
                    Next photo every
                    <input
                      type="number"
                      min={1}
                      value={intervalSec}
                      onChange={(e) => setIntervalSec(Math.max(1, Number(e.target.value) || 1))}
                      className="border-ink/15 min-h-9 w-16 rounded border bg-white px-2 py-1 text-sm"
                      suppressHydrationWarning
                    />
                    seconds
                  </label>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-ink-soft text-xs font-medium">Preview · {DISPLAY_MODE_NAME[displayMode]}</span>
                  <span className="bg-ink/10 h-px flex-1" />
                </div>
                <div className="mt-2">
                  <DisplayModePreview mode={displayMode} thumbs={previewThumbs} />
                </div>
                {PREVIEW_NOTE[displayMode] && (
                  <p className="text-ink-soft mt-2 text-xs">{PREVIEW_NOTE[displayMode]}</p>
                )}
              </div>
            </SectionCard>

            <SectionCard id="Link" n="04" title="Link" sub="Share this page directly">
              {nfcSlug ? (
                <div>
                  <span className="text-ink-soft text-xs font-medium">Page Link</span>
                  <p className="font-meta text-ink mt-1.5 truncate text-[13px]">
                    {host}/p/{nfcSlug}
                  </p>
                  <button type="button" onClick={handleCopyLink} className={buttonClass("secondary", "sm", "mt-3")}>
                    Copy link
                  </button>
                  <p className="text-ink-soft mt-2 text-xs">Write this link to the page&rsquo;s NFC tag.</p>
                </div>
              ) : (
                <p className="text-ink-soft text-sm">Save this page to create its link.</p>
              )}
            </SectionCard>
          </div>
        </div>
      </div>

      <div className="bg-paper/95 border-ink/10 sticky bottom-0 z-10 flex justify-center border-t px-5 pb-4 pt-3 shadow-[0_-6px_18px_rgba(34,32,27,0.1)] sm:px-8">
        <div className="flex w-full max-w-[720px] gap-3">
          <button type="button" onClick={handleCancel} className={buttonClass("ghost", "lg", "flex-none")}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className={buttonClass("primary", "lg", "flex-1")}>
            {saving ? "Saving…" : "Save page"}
          </button>
        </div>
      </div>

      {picker && (
        <DriveFolderPicker
          onClose={() => setPicker(null)}
          onPick={(folder) => {
            addFolder(folder.id, picker.mode === "change" ? picker.index : undefined);
            setPicker(null);
          }}
        />
      )}

      {confirmDiscard && (
        <Dialog
          title="Discard your changes?"
          onClose={() => setConfirmDiscard(false)}
          compact
          maxWidth={400}
          footer={
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setConfirmDiscard(false)} className={buttonClass("ghost", "md")}>
                Keep editing
              </button>
              <Link href={albumHref} className={buttonClass("danger", "md")}>
                Discard
              </Link>
            </div>
          }
        >
          <p className="text-ink-soft mt-2.5 text-sm leading-relaxed">
            You have unsaved changes on this page. Leaving now loses them.
          </p>
        </Dialog>
      )}

      <Toast message={toast} />
    </main>
  );
}
