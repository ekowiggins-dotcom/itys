import { describe, expect, it } from "vitest";
import { appBannerMeta, isAppClient } from "@/lib/app-client";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const APP_1_0 = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const APP_1_1 = `${APP_1_0} WhollApp/1.1`;
const INSTAGRAM = `${APP_1_0} Instagram 350.0.0.0 (iPhone14,5; iOS 18_0)`;

describe("telling the app from a browser (sign-in is app-only)", () => {
  it("knows the app by its user-agent marker (1.1+) or by the cookie the page sets in the app (1.0)", () => {
    expect(isAppClient(APP_1_1, undefined)).toBe(true);
    expect(isAppClient(APP_1_0, "1")).toBe(true);
  });

  it("treats browsers and other apps' web views as the website", () => {
    expect(isAppClient(SAFARI, undefined)).toBe(false);
    expect(isAppClient(APP_1_0, undefined)).toBe(false); // 1.0 before its first page load sets the cookie
    expect(isAppClient(INSTAGRAM, undefined)).toBe(false);
    expect(isAppClient(null, "0")).toBe(false);
  });

  it("puts an invite in Safari's app banner", () => {
    expect(appBannerMeta("https://x.test/c/abc")["apple-itunes-app"]).toBe("app-id=6831526797, app-argument=https://x.test/c/abc");
  });
});
