"use client";

import { signIn } from "next-auth/react";
import { buttonClass } from "./ui/styles";

/** Primary "Sign in with Google" pill (teal, Google colour dot). */
export default function LoginButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
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
