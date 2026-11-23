import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iOS app is a native shell around the live web app: pages are rendered by the server (server actions,
 * per-user data), so the app loads APP_ORIGIN. native-shell/ is only the offline fallback page.
 * Native extras: push notifications, a home-screen widget, the share sheet, haptics and universal links.
 */
const origin = process.env.APP_ORIGIN ?? "https://wholl.example";

const config: CapacitorConfig = {
  appId: process.env.IOS_BUNDLE_ID ?? "app.wholl.ios",
  appName: "Who’ll",
  webDir: "native-shell",
  server: {
    url: origin,
    // Only our own site loads inside the app; other links open in Safari.
    allowNavigation: [new URL(origin).host],
    errorPath: "index.html",
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#17201b",
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
