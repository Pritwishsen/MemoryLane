"use client";

import { signIn } from "next-auth/react";
import { buttonClass } from "./ui/styles";
import { HOST_AUTH_PARAMS } from "@/lib/scopes";

/** Primary "Sign in with Google" pill (teal, Google colour dot). `host`
 *  sign-ins also grant full Drive so the app can share folders. */
export default function LoginButton({ callbackUrl, host = false }: { callbackUrl: string; host?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl }, host ? HOST_AUTH_PARAMS : undefined)}
      className={buttonClass("primary", "lg", "w-full shadow-sm")}
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 rounded-full"
        style={{ background: "conic-gradient(#EA4335 0 25%,#FBBC05 0 45%,#34A853 0 70%,#4285F4 0)" }}
      />
      Sign in with Google
    </button>
  );
}
