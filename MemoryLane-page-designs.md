# MemoryLane — Page-by-Page Design Spec

Hand this to Claude Code alongside the feature spec (MemoryLane-spec.md). This covers visual
design and layout only — the other doc covers data/logic. Build mobile-first: guests will open
almost every page on a phone right after tapping an NFC tag.

---

## Design tokens (use these everywhere, don't improvise new colors/fonts per page)

**Color**
- `--paper: #F3EDE4` — page background
- `--paper-dim: #E7DFCC` — cards, panels
- `--ink: #22201B` — primary text
- `--ink-soft: #55524A` — secondary text
- `--teal: #1F4E4A` — primary action color, links, map pin ring
- `--brass: #B58A46` — accents, badges, dividers
- `--stamp: #A6402C` — the one "alert" color: access-denied, delete, required-field markers

**Type**
- **Display (headers, page titles, album/page names):** Fraunces, weight 600–700
- **Body (paragraphs, form labels, buttons, nav):** Inter, weight 400–600
- **Meta (slugs, timestamps, counts, stamps, badges):** Space Mono, weight 400–700, uppercase,
  letter-spacing 0.04–0.08em

**Layout**
- Max content width 480px on guest-facing pages (phone-first, centered on desktop)
- Max content width 720px on host dashboard/editor pages (more data density, used on laptop)
- Corner radius: 10px on cards, 4px on photos/postcards, full-round on buttons/pins/avatars
- Consistent 20px page padding on mobile, 32px on desktop

**Signature element**
- Every place/page in the album renders as a "postmark" — a circular stamp badge with the
  location name and a rotated angle, used consistently on: page cards in the editor, map pins,
  and the header of the guest page view. This is the one recurring motif that ties the whole
  app together — don't introduce a second competing visual metaphor.

---

## 1. Landing page (`/`)

Purpose: first thing anyone sees, splits into host vs guest.

```
┌─────────────────────────────┐
│                               │
│         (stamp icon)         │
│                               │
│         MEMORYLANE            │  <- Fraunces, large
│  Tap a place, walk back into  │  <- Inter, muted, one line
│         the moment            │
│                               │
│   ┌───────────────────────┐  │
│   │   Create an Album      │  │  <- teal filled button
│   └───────────────────────┘  │
│   ┌───────────────────────┐  │
│   │   I'm a Guest           │  │  <- outline button
│   └───────────────────────┘  │
│                               │
└─────────────────────────────┘
```
- Vertically centered, no scrolling, no marketing sections below the fold
- Background: paper, with a very faint large stamp-ring graphic behind the wordmark for texture
  (low opacity, decorative only)

---

## 2. Sign-in screen (shared by host + guest, `/create` and `/guest` redirect here if logged out)

```
┌─────────────────────────────┐
│  ← Back                      │
│                               │
│      Sign in to continue     │
│                               │
│  ┌─────────────────────────┐│
│  │  G  Continue with Google ││
│  └─────────────────────────┘│
│                               │
│  Guests: you'll only see     │
│  albums the host has shared  │
│  their photos with you for.  │
└─────────────────────────────┘
```
- Single button, no email/password option — Google only
- The helper text under the button changes depending on whether they arrived via **Create
  Album** or **I'm a Guest** (host version: no helper text needed, or "Your albums stay private
  until you invite someone")

---

## 3. Host dashboard (`/dashboard`)

Purpose: list of the host's albums.

```
┌─────────────────────────────┐
│  MEMORYLANE        (avatar)  │  <- top bar, name/photo top right
│                               │
│  Your Albums      + New      │
│  ─────────────────────────   │
│  ┌─────────────────────────┐│
│  │ ◐ Summer in Rajasthan    ││  <- card: title
│  │   6 pages · created Aug  ││     meta line in Space Mono
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ ◐ Tokyo 2025             ││
│  │   3 pages · created Jun  ││
│  └─────────────────────────┘│
│                               │
└─────────────────────────────┘
```
- Empty state (no albums yet): centered message + illustration —
  *"No albums yet. Every trip starts somewhere — create your first one."* + **New Album** button
- Tapping a card opens the album editor
- `+ New` opens a lightweight inline prompt for the album title, then creates and opens it

---

## 4. Album editor (`/dashboard/[albumId]`)

Purpose: manage pages inside one album, invite guests.

```
┌─────────────────────────────┐
│  ← Albums                    │
│                               │
│  Summer in Rajasthan         │  <- Fraunces title, editable inline
│  6 pages                     │
│                               │
│  [ Invite guests ]            │  <- brass outline button
│                               │
│  Pages            + Add page │
│  ─────────────────────────   │
│  ┌─────────────────────────┐│
│  │ ⠿  Brass Elephant         ││  <- drag handle, header text
│  │    Jaipur, India          ││     location, muted
│  │    tag: jaipur-elephant-x1││     Space Mono slug + copy icon
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ ⠿  Blue Pottery Bowl      ││
│  │    Jaipur, India          ││
│  │    tag: jaipur-bowl-k9  📋││
│  └─────────────────────────┘│
│                               │
└─────────────────────────────┘
```
- Each page row is draggable (⠿ handle) to reorder
- Tapping a row (not the drag handle) opens that page's editor
- Copy icon on the slug copies the full NFC URL, with a toast: "Link copied — write it to your
  NFC tag"
- Swipe-to-delete or a small trash icon per row, with a confirm step (deleting a page removes its
  tag link — should not be a silent action)

---

## 5. Page editor (`/dashboard/[albumId]/page/[pageId]`)

Purpose: the form for one souvenir/place.

```
┌─────────────────────────────┐
│  ← Back to album              │
│                               │
│  Header                       │
│  [ Brass Elephant           ] │
│                               │
│  Story                        │
│  [ Bought this from a stall  ]│
│  [ near the Amber Fort...    ]│
│                               │
│  Location                     │
│  [ Jaipur, India            ] │
│                               │
│  Google Drive folder          │
│  [ paste folder link         ]│
│                               │
│  Show images                  │
│  ( ) All photos in folder      │
│  (•) Starred only              │
│  ( ) Tagged — keyword: [____]  │
│                               │
│  Display as                   │
│  ( ) Grid   (•) Slideshow      │
│                               │
│  ┌─────────────────────────┐│
│  │        Save page          ││
│  └─────────────────────────┘│
│                               │
│  NFC link                     │
│  memorylane.app/p/jaipur-eleph…│
│  [ Copy link ]                │
└─────────────────────────────┘
```
- Radio groups, not dropdowns — these are binary/ternary choices, keep them visible at a glance
- The keyword field for "Tagged" only appears/enables when that radio is selected
- The NFC link block only appears after the page has been saved at least once (a slug can't exist
  before the page does)
- Inline validation: Drive folder field shows a small teal checkmark once the app successfully
  reads the folder, or a stamp-red note if it can't access it yet

---

## 6. Invite guests (modal or slide-up sheet, triggered from album editor)

```
┌─────────────────────────────┐
│  Invite to "Summer in        │
│  Rajasthan"              ✕   │
│                               │
│  Guest email                  │
│  [ friend@email.com          ]│
│                               │
│  Note (optional)              │
│  [ Come relive our trip!     ]│
│                               │
│  ⚠ Remember to share your     │
│  Drive folders with this      │
│  email too — that's what      │
│  actually lets them see       │
│  the photos.                  │
│                               │
│  [ Send invite ]              │
└─────────────────────────────┘
```
- The reminder line is important and should always be visible, not collapsed/hidden — this is
  the single most common way a host will confuse guests ("I sent the invite but they can't see
  anything")

---

## 7. Guest summary page (`/guest/[albumId]/summary`)

Purpose: shown right after a guest signs in — the "overview" before they start tapping tags.

```
┌─────────────────────────────┐
│  Summer in Rajasthan          │  <- Fraunces
│  Here's everywhere we went —  │  <- host's intro text
│  tap a souvenir to relive it  │
│                               │
│  ┌─────────────────────────┐│
│  │                           ││
│  │        (map view)         ││  <- Leaflet map, full width
│  │     ◉ Jaipur   ◉ Udaipur  ││     pins styled as small stamps
│  │                           ││
│  └─────────────────────────┘│
│                               │
│  Or browse pages directly:    │
│  • Brass Elephant — Jaipur    │
│  • Blue Pottery Bowl — Jaipur │
│  • Lake Palace photo — Udaipur│
└─────────────────────────────┘
```
- Map pins are tappable → open that page directly (`/p/[slug]`), same as scanning the tag
- The list under the map is a fallback for guests without the physical tags in front of them yet
- If a page's location couldn't be geocoded, it just doesn't get a pin but still appears in the
  list below — don't block the whole page on one bad location

---

## 8. Page view — what scanning a tag opens (`/p/[nfcSlug]`)

Purpose: the actual "reveal" moment. This is the emotional core of the product — give it the most
visual care.

```
┌─────────────────────────────┐
│  ← Summary                    │
│                               │
│        (stamp: JAIPUR)        │  <- rotated postmark badge
│                               │
│  Brass Elephant                │  <- Fraunces, large
│  JAIPUR, INDIA                 │  <- Space Mono, teal, uppercase
│                               │
│  Bought this from a stall     │  <- Inter, body text
│  near the Amber Fort...       │
│                               │
│  ─────────────────────────    │
│                               │
│  [ Grid or slideshow of       │
│    photos pulled live from    │
│    the Drive folder ]         │
│                               │
└─────────────────────────────┘
```
- **Grid mode:** 2-column responsive photo grid, tap any photo to open a lightbox/fullscreen view
- **Slideshow mode:** one large photo, auto-advances every ~4s, with manual left/right tap zones
  and dots indicating position; pause auto-advance if the guest interacts
- Loading state while Drive photos fetch: skeleton placeholders in the grid shape (not a generic
  spinner — keep the shape of the eventual content so it doesn't jump around)
- Access-denied state (guest not shared on the Drive folder) replaces the whole photo section:
  ```
  This album isn't shared with you yet.
  Ask [host name] to share the Google
  Drive folder for this page.
  ```
  Still show the header/story text above it — only the photos are gated, so the guest at least
  knows what they're missing and who to ask

---

## 9. Empty / edge states to build (don't skip these)

- **Dashboard, no albums:** see Section 3
- **Album editor, no pages yet:** *"This album is empty. Add your first page to get started."*
  + **Add page** button
- **Page view, Drive folder returns zero matching photos:** *"No photos match this page's filter
  yet."* — distinct from access-denied; this is a host-side configuration issue, not a
  permissions issue, so word it differently
- **Page view, Drive folder invalid/deleted:** stamp-red inline note in the page editor so the
  host catches it before a guest does
- **Slow network:** skeleton loaders on the photo grid/slideshow, never a blank white screen

---

## Consistency checklist for Claude Code

- Reuse the stamp/postmark motif for: map pins, page-view header badge, and small NFC-tag icons
  in the album editor — one visual idea, several places, not a different icon language each time
- Fraunces only for titles/headers, never for body paragraphs or buttons
- Space Mono only for meta/labels/slugs, never for body paragraphs
- Teal for primary actions, brass for secondary/informational accents, stamp-red reserved for
  destructive actions and access/error states — don't use stamp-red decoratively
