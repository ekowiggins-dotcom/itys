"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { appleNonceAction, appleSignInAction } from "../actions";
import { isNativeApp } from "../NativeBridge";

type AppleResult = { idToken: string; authorizationCode?: string; givenName?: string };
type AppleJs = {
  auth: {
    init(o: { clientId: string; scope: string; redirectURI: string; usePopup: boolean; nonce: string }): void;
    signIn(): Promise<{ authorization: { id_token: string; code?: string }; user?: { name?: { firstName?: string } } }>;
  };
};

const APPLE_JS = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

function loadAppleJs(): Promise<AppleJs> {
  const w = window as unknown as { AppleID?: AppleJs };
  if (w.AppleID) return Promise.resolve(w.AppleID);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = APPLE_JS;
    s.async = true;
    s.onload = () => (w.AppleID ? resolve(w.AppleID) : reject(new Error("Apple sign-in didn’t load")));
    s.onerror = () => reject(new Error("Apple sign-in didn’t load"));
    document.head.appendChild(s);
  });
}

/** Native sheet in the iOS app; Apple's web sign-in on the website (when a Services ID is configured). */
async function askApple(nonceHash: string, servicesId: string | null): Promise<AppleResult | null> {
  if (isNativeApp()) {
    const { registerPlugin } = await import("@capacitor/core");
    const plugin = registerPlugin<{ authorize(o: { nonce: string }): Promise<AppleResult> }>("AppleSignIn");
    try {
      return await plugin.authorize({ nonce: nonceHash });
    } catch (e) {
      if (String(e).includes("cancelled")) return null;
      throw e;
    }
  }
  if (!servicesId) throw new Error("Sign in with Apple isn’t set up for the website yet.");
  const AppleID = await loadAppleJs();
  AppleID.auth.init({ clientId: servicesId, scope: "name email", redirectURI: `${location.origin}/`, usePopup: true, nonce: nonceHash });
  try {
    const r = await AppleID.auth.signIn();
    return { idToken: r.authorization.id_token, authorizationCode: r.authorization.code, givenName: r.user?.name?.firstName };
  } catch (e) {
    const err = (e as { error?: string })?.error;
    if (err === "popup_closed_by_user" || err === "user_cancelled_authorize") return null;
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

export function AppleButton({ next, servicesId }: { next: string; servicesId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [available, setAvailable] = useState(true);

  // On the website without a Services ID there's nothing to offer; the iOS app always has it.
  useEffect(() => {
    if (!isNativeApp() && !servicesId) setAvailable(false); // eslint-disable-line react-hooks/set-state-in-effect -- needs the browser check
  }, [servicesId]);
  if (!available) return null;

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
            const result = await askApple(await appleNonceAction(), servicesId);
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

/** Email sign-in, shown on the website only (the iOS app uses Apple), unless App Review access is on. */
export function WebOnly({ children, alsoInApp = false }: { children: React.ReactNode; alsoInApp?: boolean }) {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []); // eslint-disable-line react-hooks/set-state-in-effect -- needs the browser check
  return native && !alsoInApp ? null : <>{children}</>;
}
