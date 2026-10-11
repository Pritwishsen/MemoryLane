"use client";

import { useEffect, useState } from "react";

/** Toast message state that clears itself after `ms`. */
export function useToast(ms = 3000) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast, ms]);
  return [toast, setToast] as const;
}

export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="bg-ink font-meta-label fixed bottom-6 left-1/2 z-[1200] -translate-x-1/2 rounded-full px-4 py-2 text-[11px] text-white shadow-lg"
    >
      {message}
    </div>
  );
}
