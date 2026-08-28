# MemoryLane

A web app where a host builds an "album" made of pages — one per place or memory — each pulling
photos live from a Google Drive folder. Every page is bound to an NFC tag: guests scan the tag,
sign in with Google, and see that page — but only if the host has actually shared that Drive
folder with them. A summary page shows every location pinned on a world map.

See [`MemoryLane-spec.md`](./MemoryLane-spec.md) for the full feature/data-model spec and
[`MemoryLane-page-designs.md`](./MemoryLane-page-designs.md) for the visual design spec.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS v4, NextAuth.js (Google), Firebase Firestore,
Google Drive API, Leaflet + OpenStreetMap, Nominatim geocoding, Resend for invite emails.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
