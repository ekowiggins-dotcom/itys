"use client";

import { useSyncExternalStore } from "react";
import { isNativeApp } from "../NativeBridge";

const noop = () => () => {};

/** Renders its children on the website only, never inside the iOS app (e.g. "Download on the App Store"). */
export function WebOnly({ children }: { children: React.ReactNode }) {
  const native = useSyncExternalStore(noop, isNativeApp, () => false);
  return native ? null : <>{children}</>;
}
