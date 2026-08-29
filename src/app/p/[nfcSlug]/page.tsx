import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getPageBySlug } from "@/lib/albums";
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
import PhotoGrid, { type DisplayPhoto } from "@/components/PhotoGrid";
import PhotoSlideshow from "@/components/PhotoSlideshow";

type PageProps = { params: Promise<{ nfcSlug: string }> };

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

  const locationLine = [page.place, page.country].filter(Boolean).join(", ");
  const folderIds = page.driveFolderIds ?? [];

  let photos: DisplayPhoto[] = [];
  let photoError: string | null = null;
  let accessDenied = false;

  if (folderIds.length > 0) {
    if (session.error || !session.accessToken) {
      photoError = "There was a problem with your Google sign-in — try signing out and back in.";
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

  return (
    <main className="flex-1 px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="flex items-start justify-between">
          <Postmark label={page.place || page.country || undefined} size="lg" />
          <AccountBadge name={session.user?.name ?? null} image={session.user?.image ?? null} />
        </div>

        <h1 className="font-display text-ink mt-5 text-3xl font-semibold">
          {page.header}
        </h1>
        {locationLine && (
          <p className="font-meta-label text-teal mt-1 text-xs">{locationLine}</p>
        )}

        {page.bodyText && (
          <p className="text-ink mt-5 text-sm leading-relaxed whitespace-pre-wrap">
            {page.bodyText}
          </p>
        )}

        <hr className="border-ink/10 my-6" />

        {accessDenied ? (
          <p className="text-stamp text-sm">
            This album isn&rsquo;t shared with you yet. Ask {host?.name ?? "the host"} to
            share the Google Drive folder for this page.
          </p>
        ) : photoError ? (
          <p className="text-stamp text-sm">{photoError}</p>
        ) : photos.length === 0 ? (
          <p className="text-ink-soft text-center text-sm">
            No photos match this page&rsquo;s filter yet.
          </p>
        ) : page.displayMode === "slideshow" ? (
          <PhotoSlideshow photos={photos} intervalSec={page.slideshowIntervalSec} />
        ) : (
          <PhotoGrid photos={photos} />
        )}
      </div>
    </main>
  );
}
