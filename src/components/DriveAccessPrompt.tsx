"use client";

import { signIn } from "next-auth/react";
import { buttonClass } from "./ui/styles";
import { DRIVE_READONLY } from "@/lib/scopes";

/** Shown on a tag page when the guest's Google sign-in carries no Drive
 *  access, almost always because the Drive checkbox on Google's consent
 *  screen was left unticked. Re-asks for read-only Drive and comes back to
 *  the same page. `expired` covers a refresh token Google no longer honours. */
export default function DriveAccessPrompt({ callbackUrl, expired = false }: { callbackUrl: string; expired?: boolean }) {
  return (
    <div className="border-stamp/30 bg-stamp/[0.05] rounded-[10px] border p-4">
      <p className="text-ink text-sm font-semibold">
        {expired ? "Your Google sign-in has expired" : "MemoryLane can't see your Google Drive yet"}
      </p>
      <p className="text-ink-soft mt-1 text-[13px] leading-relaxed">
        {expired
          ? "Sign in again to keep seeing these photos."
          : "The photos live in Google Drive. When Google asks, tick the box that lets MemoryLane see your Drive files. It only reads the folders your host shared with you."}
      </p>
      <button
        type="button"
        onClick={() =>
          signIn("google", { callbackUrl }, { scope: `openid email profile ${DRIVE_READONLY}`, prompt: "consent" })
        }
        className={buttonClass("primary", "md", "mt-3")}
      >
        {expired ? "Sign in again" : "Give Drive access"}
      </button>
    </div>
  );
}
