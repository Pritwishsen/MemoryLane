import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { deletePage, getOwnedAlbum, getPage, updatePage } from "@/lib/albums";
import { parseDriveFolderId } from "@/lib/drive";
import { geocodeLocation } from "@/lib/geocode";
import type { ImageFilter, DisplayMode, Page } from "@/types/models";

type RouteContext = { params: Promise<{ albumId: string; pageId: string }> };

const IMAGE_FILTERS: ImageFilter[] = ["all", "tagged"];
const DISPLAY_MODES: DisplayMode[] = ["grid", "slideshow"];

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId, pageId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await getPage(albumId, pageId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const fields: Partial<Page> = {};

  if (typeof body.header === "string" && body.header.trim()) {
    fields.header = body.header.trim();
  }
  if (typeof body.bodyText === "string") fields.bodyText = body.bodyText;

  if (Array.isArray(body.driveFolderInputs)) {
    const ids: string[] = [];
    for (const input of body.driveFolderInputs) {
      if (typeof input !== "string" || !input.trim()) continue;
      const parsed = parseDriveFolderId(input);
      if (!parsed) {
        return NextResponse.json(
          { error: `Couldn't read a folder ID from "${input.trim()}"` },
          { status: 400 }
        );
      }
      if (!ids.includes(parsed)) ids.push(parsed);
    }
    fields.driveFolderIds = ids;
  }

  if (body.imageFilter !== undefined) {
    if (!IMAGE_FILTERS.includes(body.imageFilter)) {
      return NextResponse.json({ error: "Invalid imageFilter" }, { status: 400 });
    }
    fields.imageFilter = body.imageFilter;
  }
  if (typeof body.tagKeyword === "string") fields.tagKeyword = body.tagKeyword;

  if (body.displayMode !== undefined) {
    if (!DISPLAY_MODES.includes(body.displayMode)) {
      return NextResponse.json({ error: "Invalid displayMode" }, { status: 400 });
    }
    fields.displayMode = body.displayMode;
  }

  if (typeof body.place === "string") fields.place = body.place;
  if (typeof body.country === "string") fields.country = body.country;

  if (body.place !== undefined || body.country !== undefined) {
    const place = (typeof body.place === "string" ? body.place : existing.place ?? "").trim();
    const country = (
      typeof body.country === "string" ? body.country : existing.country ?? ""
    ).trim();
    const combined = [place, country].filter(Boolean).join(", ");
    const existingCombined = [existing.place ?? "", existing.country ?? ""]
      .filter(Boolean)
      .join(", ");

    if (!combined) {
      fields.lat = null;
      fields.lng = null;
    } else if (combined !== existingCombined) {
      const geo = await geocodeLocation(combined);
      fields.lat = geo?.lat ?? null;
      fields.lng = geo?.lng ?? null;
    }
  }

  if (typeof body.randomizeAll === "boolean") fields.randomizeAll = body.randomizeAll;

  if (body.randomLimit !== undefined) {
    const n = Number(body.randomLimit);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json(
        { error: "randomLimit must be a positive number" },
        { status: 400 }
      );
    }
    fields.randomLimit = Math.floor(n);
  }

  if (body.slideshowIntervalSec !== undefined) {
    const n = Number(body.slideshowIntervalSec);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json(
        { error: "slideshowIntervalSec must be a positive number" },
        { status: 400 }
      );
    }
    fields.slideshowIntervalSec = Math.floor(n);
  }

  await updatePage(albumId, pageId, fields);
  const updated = await getPage(albumId, pageId);
  return NextResponse.json({ page: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { albumId, pageId } = await params;
  const album = await getOwnedAlbum(albumId, session.uid);
  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deletePage(albumId, pageId);
  return NextResponse.json({ ok: true });
}
