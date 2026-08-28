# MemoryLane — NFC-Triggered Memory Album

## One-line pitch
A web app where a host builds an "album" made of pages — one per place or memory — each pulling
photos live from a Google Drive folder. Every page is bound to an NFC tag. Guests scan a tag,
sign in with Google, and see that page — but only if the host has actually shared that Drive
folder with them. A summary page shows all locations pinned on a world map.

Give this whole document to Claude Code as the project brief. Build it as a single Next.js app,
deployable on Replit.

---

## Tech stack (recommended)

- **Framework:** Next.js (App Router), React, TypeScript
- **Auth:** NextAuth.js with Google provider, requesting these scopes:
  - `openid email profile`
  - `https://www.googleapis.com/auth/drive.readonly`
- **Database:** Firebase Firestore (pairs naturally with Google auth; free tier is enough).
  Alternative if the host prefers: Supabase (Postgres).
- **Image source:** Google Drive API v3 (`files.list` scoped to a folder ID)
- **Map:** Leaflet + OpenStreetMap tiles (free, no API key) for the summary map. If a Google Maps
  key is available, Google Maps JS API is a fine swap.
- **Geocoding:** Convert a typed place name ("Jaipur, India") to lat/lng using the free
  Nominatim/OpenStreetMap geocoding API, cached in Firestore so it's only looked up once per page.
- **Email invites:** Resend or SendGrid (free tier) triggered from a Next.js API route.
- **Hosting:** Replit (Node.js environment). Store all API keys as Replit Secrets, never in code.

---

## Data model (Firestore collections)

**users**
- `uid`, `email`, `name`, `photoUrl`

**albums**
- `id`, `ownerUid`, `title`, `createdAt`
- `pages: []` (array of page IDs, defines order)

**pages** (subcollection under album, or top-level with `albumId` field)
- `id`, `albumId`, `nfcSlug` (unique short id used in the tag URL, e.g. `jaipur-elephant-x1`)
- `header` (title shown on page)
- `bodyText`
- `locationName` (typed by host, e.g. "Jaipur, India")
- `lat`, `lng` (geocoded once, cached)
- `driveFolderId`
- `imageFilter`: `"all"` | `"starred"` | `"tagged"`
- `tagKeyword` (used only if `imageFilter === "tagged"` — matches against each Drive file's
  **description** field, since Drive folders don't support custom tags natively; host adds a
  short description to a photo in Drive to "tag" it)
- `displayMode`: `"grid"` | `"slideshow"`
- `createdAt`, `updatedAt`

**invites**
- `id`, `albumId`, `guestEmail`, `invitedAt`, `status: "sent" | "opened"`

No separate ACL table is needed for view permission — see **Access control** below.

---

## Pages / routes

| Route | Purpose |
|---|---|
| `/` | Landing page (public) |
| `/create` | Redirects to Google sign-in if not authenticated, then to album dashboard |
| `/dashboard` | Host's list of albums, "New album" button |
| `/dashboard/[albumId]` | Album editor: reorder pages, add/remove pages, invite guests |
| `/dashboard/[albumId]/page/[pageId]` | Page editor: header, text, location, Drive folder, filter, display mode |
| `/guest` | Guest entry point, Google sign-in |
| `/guest/[albumId]/summary` | World map + intro text, shown right after guest signs in |
| `/p/[nfcSlug]` | The actual page a guest lands on when they scan an NFC tag — this is the URL written to the physical tag |

---

## Feature 1 — Landing page

Shared by everyone, no login required.

- App name + one-line pitch (from the two options above, or the host's own choice)
- Two buttons: **Create Album** and **I'm a Guest**
- Keep it to one screen: no scrolling marketing copy needed — this is a personal-use tool, not a
  SaaS product, so the tone should be warm and simple rather than a sales pitch

## Feature 2 — Host authentication

- Clicking **Create Album** triggers Google sign-in via NextAuth if not already signed in
- On first login, create a `users` doc
- After login, redirect to `/dashboard`

## Feature 3 — Album dashboard

- List of the host's existing albums (title + page count + created date)
- **New album** button → prompts for a title → creates album → opens album editor

## Feature 4 — Album editor

- Add page / remove page (each page = one souvenir/place/memory)
- Drag-to-reorder pages (order isn't critical functionally, but nice for a "collection" feel)
- Each page in the list shows its header + location + a small NFC icon with its slug, since the
  host needs the slug to know which tag to write
- **Invite guests** button (see Feature 7)

## Feature 5 — Page editor

For each page, the host sets:
- **Header** (short title, e.g. "The brass elephant")
- **Body text** (the memory/story)
- **Location name** (free text — geocoded automatically on save)
- **Google Drive folder**: host pastes a Drive folder link or ID
- **Image filter**, radio choice:
  - *All images in folder*
  - *Starred only* — queries Drive with `q: "'<folderId>' in parents and starred = true"`
  - *Tagged only* — host also enters a keyword; app matches it against each file's Drive
    **description** field (`q: "'<folderId>' in parents"`, then filter client-side on
    `file.description` containing the keyword, case-insensitive)
- **Display mode**: *Grid* (responsive photo grid) or *Slideshow* (auto-advancing carousel with
  manual next/prev)
- Save generates/keeps a unique `nfcSlug` for this page and shows the full tag URL
  (`https://<replit-app-url>/p/<nfcSlug>`) with a **Copy link** button, ready to write to an
  NFC tag with an app like NFC Tools

## Feature 6 — Access control (important — this is the security model)

There is **no custom permission system**. Access is enforced by real Google Drive sharing:

1. When a guest opens `/p/[nfcSlug]`, require Google sign-in if not already signed in
2. Once signed in, the app attempts to call Drive API `files.list` on that page's
   `driveFolderId` **using the guest's own OAuth access token**, not the host's
3. If the call succeeds (guest has been shared the folder by the host in actual Google Drive),
   render the page normally
4. If it fails with a permission error, show a clear message: *"You don't have access to this
   album yet. Ask [host name] to share the Google Drive folder with you."* — do not reveal any
   page content, header text, or location in this case
5. This means the host's real, ordinary Google Drive sharing settings are the single source of
   truth. No separate invite-acceptance database is required for security — invites (below) are
   just a convenience for sending the link, not what grants access

## Feature 7 — Invite guests

- On the album editor, **Invite** opens a form: guest email + optional short message
- Sends an email (via Resend/SendGrid) containing the album summary link
  (`/guest/[albumId]/summary`) and a short reminder: *"Make sure the album's Drive folders are
  shared with this email before they can view the photos."*
- Log the invite in the `invites` collection for the host's own reference (who's been invited,
  whether they've opened it) — this is informational only, not an access gate

## Feature 8 — Guest summary page

Shown right after a guest signs in via `/guest` or `/guest/[albumId]/summary`:
- A world map (Leaflet) with a pin for every page's geocoded location
- A short intro text block the host can set at the album level (e.g. "Here's everywhere we
  went this year — tap the souvenir to relive it")
- Pins are clickable → jump to that page's full view (useful for browsing without NFC tags, e.g.
  before all tags are physically placed)

## Feature 9 — Page view (what scanning an NFC tag opens)

Route: `/p/[nfcSlug]`
- Runs the access check from Feature 6 first
- If access granted: show header, body text, location, and the photo grid or slideshow per the
  host's saved settings, pulling live from the Drive folder each time (no image copying/storage —
  always fetch fresh from Drive so the host can keep adding photos later)
- Small "back to summary map" link at the top

---

## Build order suggestion for Claude Code

1. Scaffold Next.js app, set up NextAuth with Google provider and Drive scope
2. Firestore setup + data models above
3. Landing page + host dashboard + album/page CRUD (no Drive integration yet, just forms)
4. Drive API integration: list files in a folder, starred filter, description-tag filter
5. Page view rendering (grid + slideshow modes)
6. Access-control check using guest's own token (Feature 6) — test this carefully, it's the
   security-critical part
7. Geocoding + Leaflet map summary page
8. Email invite flow
9. Polish: loading states, empty states (no pages yet, no photos matching filter, access denied)

## Environment setup notes for the host (outside of code)

- Create a Google Cloud project, enable the **Google Drive API**
- Configure the OAuth consent screen, add the `drive.readonly` scope
- Create OAuth client credentials (type: Web application), add the Replit app's URL as an
  authorized redirect URI
- Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, Firebase config, and email API key as Replit
  Secrets — never hard-code these

