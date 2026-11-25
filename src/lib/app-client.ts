/**
 * Sign-in happens only in the iOS app. These tell the app apart from a web browser.
 *
 * - App builds from 1.1 add "WhollApp/<version>" to the web view's user agent (capacitor.config.ts).
 * - The 1.0 build doesn't, so the page itself sets the APP_COOKIE as soon as it finds the app's native bridge
 *   (AppMarker), and refreshes. From then on the server sees it on every request.
 *
 * Neither is a security boundary (both can be faked): it decides what to offer, not who may do what.
 */
export const APP_UA_MARKER = "WhollApp/";
export const APP_COOKIE = "wholl_app";

export function isAppClient(userAgent: string | null | undefined, appCookie: string | null | undefined) {
  return (userAgent ?? "").includes(APP_UA_MARKER) || appCookie === "1";
}

/** The App Store listing. */
export const APP_STORE_ID = process.env.APP_STORE_ID || "6831526797";
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

/** Safari's "Get the app" banner; with a URL, "Open" in the banner opens that page in the app. */
export function appBannerMeta(url?: string) {
  return { "apple-itunes-app": url ? `app-id=${APP_STORE_ID}, app-argument=${url}` : `app-id=${APP_STORE_ID}` };
}
