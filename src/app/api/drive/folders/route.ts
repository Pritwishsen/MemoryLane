import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { folderStats, getFolderBreadcrumb, listChildFolders } from "@/lib/drive";

const ID_RE = /^[a-zA-Z0-9_-]{10,}$/;

/**
 * Drive folder browser for the page editor's "Choose a Drive folder" dialog.
 *   GET ?parent=root | shared | <folderId>  → { breadcrumb, folders: [{id,name}] }
 *   GET ?stats=<id>,<id>,…                  → { stats: { [id]: {count,capped,thumb} | null } }
 * The listing returns at once; the picker then asks for counts/thumbnails
 * separately, so a Drive with many big folders doesn't stall the dialog.
 */
export async function GET(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;
  if (!session.accessToken || session.error) {
    return NextResponse.json({ error: "Your Google sign-in needs refreshing — sign in again" }, { status: 401 });
  }

  const statsParam = req.nextUrl.searchParams.get("stats");
  if (statsParam !== null) {
    const ids = statsParam.split(",").filter((id) => ID_RE.test(id)).slice(0, 40);
    return NextResponse.json({ stats: await folderStats(session.accessToken, ids) });
  }

  const parent = req.nextUrl.searchParams.get("parent") || "root";
  if (parent !== "root" && parent !== "shared" && !ID_RE.test(parent)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  try {
    const [folders, breadcrumb] = await Promise.all([
      listChildFolders(session.accessToken, parent),
      parent === "root"
        ? Promise.resolve([{ id: "root", name: "My Drive" }])
        : parent === "shared"
          ? Promise.resolve([{ id: "shared", name: "Shared with me" }])
          : getFolderBreadcrumb(session.accessToken, parent),
    ]);
    return NextResponse.json({ breadcrumb, folders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't read your Drive";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
