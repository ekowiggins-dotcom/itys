"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerDeviceAction, widgetTokenAction } from "./actions";

type WidgetBridge = { configure(o: { token: string; baseUrl: string }): Promise<void>; clear(): Promise<void> };

/** True inside the iOS app (Capacitor injects its bridge into our pages). */
export function isNativeApp() {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/**
 * Connects the web app to the iOS app's native features, when it runs inside the app (no-op on the web):
 * - push: asks for permission, registers this phone for the signed-in session, opens the right page on tap
 * - widget: hands the home-screen widget a read-only token (once per account on this phone)
 * - universal links: invite and sign-in links that open the app go to the right page
 */
export function NativeBridge({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    const cleanups: (() => void)[] = [];
    let cancelled = false;

    (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const { App } = await import("@capacitor/app");
      const { registerPlugin } = await import("@capacitor/core");
      if (cancelled) return;

      const reg = await PushNotifications.addListener("registration", (t) => void registerDeviceAction(t.value));
      const tap = await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
        const href = (a.notification.data as { href?: string } | undefined)?.href;
        if (href?.startsWith("/")) router.push(href);
      });
      const link = await App.addListener("appUrlOpen", ({ url }) => {
        const u = new URL(url);
        if (u.origin === location.origin) router.push(u.pathname + u.search + u.hash);
      });
      cleanups.push(() => void reg.remove(), () => void tap.remove(), () => void link.remove());

      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
      if (perm.receive === "granted") await PushNotifications.register();

      const key = `wholl.widget.${userId}`;
      try {
        if (!localStorage.getItem(key)) {
          const token = await widgetTokenAction();
          await registerPlugin<WidgetBridge>("WidgetBridge").configure({ token, baseUrl: location.origin });
          localStorage.setItem(key, "1");
        }
      } catch {
        // The widget is a nice-to-have: never block the app on it.
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, [router, userId]);

  return null;
}

/** On sign-out inside the app, the widget is cleared too. */
export async function clearNativeWidget() {
  if (!isNativeApp()) return;
  const { registerPlugin } = await import("@capacitor/core");
  try {
    await registerPlugin<WidgetBridge>("WidgetBridge").clear();
    for (const k of Object.keys(localStorage)) if (k.startsWith("wholl.widget.")) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

/** Opens the native share sheet in the app; returns false on the web so the caller can fall back. */
export async function nativeShare(url: string, text: string) {
  if (!isNativeApp()) return false;
  const { Share } = await import("@capacitor/share");
  await Share.share({ url, text });
  return true;
}

/** A small vibration in the iOS app (no-op on the web): light for taps, success for good news. */
export async function haptic(kind: "light" | "success") {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // haptics are a nicety
  }
}
