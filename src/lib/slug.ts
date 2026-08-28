/**
 * Generates a short, URL-safe slug like "untitled-x7k2q9" for a page's NFC
 * tag URL. Generated once at page creation and never changed afterward
 * (spec: "Save generates/keeps a unique nfcSlug" — a physical tag is written
 * with this URL, so it must stay stable across future edits/renames).
 */
export function generateSlug(header: string): string {
  const base =
    header
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40) || "page";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
