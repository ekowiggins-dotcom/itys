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
    // Tells our server this is the app (sign-in happens in the app only; see src/lib/app-client.ts).
    appendUserAgent: "WhollApp/1.1",
    // Edge to edge: the pages pad themselves with env(safe-area-inset-*) (see globals.css).
    contentInset: "never",
    backgroundColor: "#17201b",
    // Only app-bound domains load. They're listed under WKAppBoundDomains in ios/App/App/Info.plist (filled from
    // WHOLL_LINK_DOMAIN, set by scripts/ios-setup.mjs from APP_ORIGIN). Without that list the web view loads
    // nothing at all: a white screen.
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
