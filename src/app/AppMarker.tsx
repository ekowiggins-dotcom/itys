"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_COOKIE } from "@/lib/app-client";
import { isNativeApp } from "./NativeBridge";

/**
 * Inside the iOS app, remembers that in a cookie so the server knows it's the app (sign-in is app-only). The 1.0
 * build has no user-agent marker, so this is how the server learns it; then the page is shown again as the app.
 */
export function AppMarker() {
  const router = useRouter();
  useEffect(() => {
    if (!isNativeApp() || document.cookie.split("; ").includes(`${APP_COOKIE}=1`)) return;
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${APP_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  }, [router]);
  return null;
}
