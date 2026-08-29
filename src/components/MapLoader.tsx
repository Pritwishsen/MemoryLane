"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so it can never run during SSR.
// `next/dynamic` with `ssr: false` handles that — but that option is only
// allowed inside a Client Component, which is the entire reason this
// pass-through wrapper exists (the guest summary page itself is a Server
// Component, since it needs to check the session and fetch data first).
const SummaryMap = dynamic(() => import("./SummaryMap"), { ssr: false });

export default SummaryMap;
