"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appleNonceAction, appleSignInAction } from "../actions";
import { isNativeApp } from "../NativeBridge";

type AppleResult = { idToken: string; authorizationCode?: string; givenName?: string };
/** The native Sign in with Apple sheet (sign-in happens in the iOS app only). */
async function askApple(nonceHash: string): Promise<AppleResult | null> {
  if (!isNativeApp()) throw new Error("Sign in with the Who’ll app on your iPhone.");
  const { registerPlugin } = await import("@capacitor/core");
  const plugin = registerPlugin<{ authorize(o: { nonce: string }): Promise<AppleResult> }>("AppleSignIn");
  try {
    return await plugin.authorize({ nonce: nonceHash });
  } catch (e) {
    if (String(e).includes("cancelled")) return null;
    throw e;
  }
}

function AppleLogo() {
  return (
    <svg width="18" height="22" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
      <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C44 791 0 671 0 557 0 374 119 277 236 277c62 0 114 41 153 41 37 0 95-43 166-43 27 0 124 2 188 66zm-219-171c29-35 50-83 50-131 0-7-1-14-2-19-48 2-104 32-138 71-27 30-52 78-52 127 0 7 1 15 2 17 3 1 9 2 14 2 43 0 97-29 126-67z" />
    </svg>
  );
}

export function AppleButton({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <div className="stack">
      <button
        type="button"
        className="apple-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(undefined);
          try {
            const result = await askApple(await appleNonceAction());
            if (!result) return;
            const r = await appleSignInAction({ ...result, next });
            if ("error" in r && r.error) setError(r.error);
            else if ("next" in r && r.next) router.replace(r.next);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign in with Apple didn’t work.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <AppleLogo />
        {busy ? "Signing in…" : "Sign in with Apple"}
      </button>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
