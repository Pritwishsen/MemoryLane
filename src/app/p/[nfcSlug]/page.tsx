import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/authOptions";
import { getPageBySlug, listPages } from "@/lib/albums";
import { getUserById } from "@/lib/users";
import {
  listDriveImages,
  driveImageUrl,
  checkDriveFoldersAccess,
  type DriveImage,
} from "@/lib/drive";
import SignInScreen from "@/components/SignInScreen";
import AccountBadge from "@/components/AccountBadge";
import Postmark from "@/components/Postmark";
import FittedPostmark from "@/components/FittedPostmark";
import PhotoGrid, { type DisplayPhoto } from "@/components/PhotoGrid";
import PhotoSlideshow from "@/components/PhotoSlideshow";
import type { DisplayMode } from "@/types/models";

type PageProps = { params: Promise<{ nfcSlug: string }> };

/** Part 2 (design_handoff_flag_map_pins v2) will extend DisplayMode with
 *  contact/stack/scrapbook/gallery and add their entries here. */
const DISPLAY_MODE_LABEL: Record<DisplayMode, string> = {
  grid: "GRID",
  slideshow: "SLIDESHOW",
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default async function TagPage({ params }: PageProps) {
  const { nfcSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    return <SignInScreen variant="guest" callbackUrl={`/p/${nfcSlug}`} />;
  }

  const result = await getPageBySlug(nfcSlug);
  if (!result) notFound();
  const { page, album } = result;

  // Sticky "next in this album" footer — GUEST_SCREENS.md's one new element
  // on this screen. getPageBySlug always resolves page+album together (or
  // null), so there's no real "opened outside an album context" case to
  // handle here; the only real hide-condition is having no next page.
  const currentIndex = album.pageOrder.indexOf(page.id);
  const nextPageId = currentIndex >= 0 ? album.pageOrder[currentIndex + 1] : undefined;
  const nextPage = nextPageId
    ? (await listPages(album.id)).find((p) => p.id === nextPageId && p.nfcSlug)
    : undefined;

  const locationLine = [page.place, page.country].filter(Boolean).join(", ");
  const folderIds = page.driveFolderIds ?? [];

  let photos: DisplayPhoto[] = [];
  let photoError: string | null = null;
  let accessDenied = false;

  if (folderIds.length > 0) {
    if (session.error || !session.accessToken) {
      photoError =
        session.error === "InsufficientScopeError"
          ? "Your Google sign-in doesn't have Drive access yet — try signing out and back in."
          : "There was a problem with your Google sign-in — try signing out and back in.";
    } else {
      try {
        // Feature 6, the security-critical check: files.get on the folder
        // itself (not files.list) reliably 404s for a folder this signed-in
        // account can't see, which is what actually enforces "only guests
        // the host has shared the real Drive folder with can see photos."
        const checks = await checkDriveFoldersAccess(session.accessToken, folderIds);
        const accessibleIds = checks.filter((c) => c.ok).map((c) => c.folderId);

        if (accessibleIds.length === 0) {
          // Only a confirmed 404 ("not-shared") on every folder means the
          // guest genuinely isn't shared on any of them. Any other failure
          // (expired token, Drive API hiccup, rate limit) is NOT evidence of
          // that — telling a guest to go ask the host when the real problem
          // is transient would be a false accusation, so those get the
          // generic error message instead.
          const deniedChecks = checks.filter(
            (c): c is Extract<typeof c, { ok: false }> => !c.ok
          );
          if (deniedChecks.every((c) => c.reason === "not-shared")) {
            accessDenied = true;
          } else {
            photoError = "Couldn't check photo access right now — try refreshing.";
          }
        } else {
          let images: DriveImage[] = await listDriveImages(
            session.accessToken,
            accessibleIds,
            page.imageFilter,
            page.tagKeyword
          );
          if (page.imageFilter === "all" && page.randomizeAll) {
            images = shuffle(images).slice(0, page.randomLimit || images.length);
          }
          // Grid thumbnails render small (~half the width of a 480px column)
          // and don't need a full-size fetch — only the slideshow's single
          // full-bleed photo does.
          const imageSize = page.displayMode === "slideshow" ? 1600 : 800;
          photos = images.map((img) => ({
            id: img.id,
            name: img.name,
            url: driveImageUrl(img.thumbnailLink, imageSize),
          }));
        }
      } catch {
        photoError = "Couldn't load photos for this page right now.";
      }
    }
  }

  const host = accessDenied ? await getUserById(album.ownerUid) : null;

  const showMetaRule = !accessDenied && !photoError;

  return (
    <main className={`flex-1 px-5 py-8 sm:px-8 ${nextPage ? "pb-[90px]" : ""}`}>
      <div className="mx-auto w-full max-w-[480px]">
        <div className="flex items-center justify-between">
          <Link
            href={`/guest/${album.id}/summary`}
            className="font-meta-label text-ink-soft hover:text-ink"
          >
            ← Summary
          </Link>
          <AccountBadge
            name={session.user?.name ?? null}
            image={session.user?.image ?? null}
            email={session.user?.email ?? null}
          />
        </div>

        <div className="mt-5 flex items-start gap-4">
          <Postmark label={page.place || page.country || undefined} size="lg" />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="font-display text-ink text-[26px] font-semibold" style={{ textWrap: "pretty" }}>
              {page.header}
            </h1>
            {locationLine && (
              <p className="font-meta-label text-teal mt-[7px] text-[9.5px]">{locationLine}</p>
            )}
          </div>
        </div>

        {page.bodyText && (
          <p className="text-ink mt-5 text-sm leading-relaxed whitespace-pre-wrap">
            {page.bodyText}
          </p>
        )}

        {showMetaRule ? (
          <div className="mt-6 flex items-center gap-[10px]">
            <span className="font-meta-label text-ink-soft shrink-0 text-[9.5px]">
              {photos.length} {photos.length === 1 ? "PHOTO" : "PHOTOS"}
            </span>
            <span className="h-px flex-1" style={{ background: "rgba(34,32,27,.12)" }} />
            <span
              className="font-meta-label shrink-0 text-[9.5px]"
              style={{ color: "var(--color-brass)" }}
            >
              {DISPLAY_MODE_LABEL[page.displayMode]}
            </span>
          </div>
        ) : (
          <hr className="border-ink/10 my-6" />
        )}

        {accessDenied ? (
          <p className="text-stamp text-sm">
            This album isn&rsquo;t shared with you yet. Ask {host?.name ?? "the host"} to
            share the Google Drive folder for this page.
          </p>
        ) : photoError ? (
          <p className="text-stamp text-sm">{photoError}</p>
        ) : photos.length === 0 ? (
          <p className="text-ink-soft mt-4 text-center text-sm">
            No photos match this page&rsquo;s filter yet.
          </p>
        ) : page.displayMode === "slideshow" ? (
          <div className="mt-4">
            <PhotoSlideshow photos={photos} intervalSec={page.slideshowIntervalSec} />
          </div>
        ) : (
          <div className="mt-4">
            <PhotoGrid photos={photos} />
          </div>
        )}
      </div>

      {nextPage && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[18px] pt-3"
          style={{
            background: "rgba(243,237,228,.96)",
            borderTop: "1px solid rgba(34,32,27,.12)",
            boxShadow: "0 -6px 18px rgba(34,32,27,.1)",
          }}
        >
          <Link href={`/p/${nextPage.nfcSlug}`} className="flex w-full max-w-[480px] items-center gap-3">
            <FittedPostmark label={nextPage.place || nextPage.country || nextPage.header} />
            <div className="min-w-0 flex-1">
              <p
                className="font-meta-label text-ink-soft text-[8.5px]"
                style={{ letterSpacing: "0.1em" }}
              >
                Next in this album
              </p>
              <p className="text-ink truncate text-[13.5px]">{nextPage.header}</p>
            </div>
            <span className="shrink-0 text-[15px]" style={{ color: "var(--color-brass)" }}>
              ›
            </span>
          </Link>
        </div>
      )}
    </main>
  );
}
