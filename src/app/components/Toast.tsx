"use client";

import { useEffect, useState } from "react";

/** A short confirmation at the bottom of the screen that fades after a few seconds. Announced to screen readers. */
export function Toast({ message, ms = 3200 }: { message: string | undefined; ms?: number }) {
  const [shown, setShown] = useState<string | undefined>();
  useEffect(() => {
    if (!message) return;
    const show = setTimeout(() => setShown(message), 0);
    const hide = setTimeout(() => setShown(undefined), ms);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [message, ms]);
  return (
    <div role="status" aria-live="polite">
      {shown && <div className="toast">{shown}</div>}
    </div>
  );
}
