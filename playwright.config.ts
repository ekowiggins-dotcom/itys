import { defineConfig, devices } from "@playwright/test";
import { APP_USER_AGENT } from "./tests/e2e/app-agent";

const port = Number(process.env.E2E_PORT ?? 3100);


/**
 * Browser tests (tests/e2e): layout at phone sizes, tap targets, overflow and accessibility, in light and
 * dark. `npm run e2e`. App Store screenshots: `npm run screenshots`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    // Sign-in happens in the iOS app only: the setup signs in with the app's user-agent marker.
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { browserName: "chromium", userAgent: APP_USER_AGENT } },
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" }, testMatch: /(layout|call-invite|waitlist)\.spec\.ts/, dependencies: ["setup"] },
    { name: "appstore", testMatch: /appstore\.spec\.ts/, use: { browserName: "chromium" }, dependencies: ["setup"] },
  ],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `http://localhost:${port}/api/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { E2E_PORT: String(port) },
  },
});
