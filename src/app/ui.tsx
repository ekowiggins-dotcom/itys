"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "./actions";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** A form wired to a server action, showing its error or success message. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className ?? "stack"}>
      {children}
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="ok">{state.ok}</p>}
      {state?.devLink && (
        <p className="dev">
          Development only: <a href={state.devLink}>open the sign-in link</a>
        </p>
      )}
    </form>
  );
}

export function Submit({ children, variant }: { children: React.ReactNode; variant?: "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={variant}>
      {pending ? "…" : children}
    </button>
  );
}

/** A hidden input holding the browser's time zone, so new groups default to the creator's. */
export function TimeZoneInput() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }, []);
  return <input ref={ref} type="hidden" name="timeZone" defaultValue="UTC" />;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

/** Opens the phone's share sheet when available; otherwise shows the link with a copy button. */
export function ShareLink({ url, text }: { url: string; text: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ url, text }).catch(() => setShown(true));
    } else {
      setShown(true); // eslint-disable-line react-hooks/set-state-in-effect -- one-off fallback after a browser check
    }
  }, [url, text]);
  if (!shown) return null;
  return (
    <div className="stack">
      <p className="invite">{url}</p>
      <div className="row">
        <CopyButton text={url} />
        <a href={url} target="_blank" rel="noreferrer" className="small">
          Open
        </a>
      </div>
      <p className="muted small">Shows the call, the answer and how many called it. No one else&apos;s name or pick.</p>
    </div>
  );
}
