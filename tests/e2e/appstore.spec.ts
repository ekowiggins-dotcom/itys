import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";
import { AUTH_FILE, openGroup } from "./helpers";

/**
 * App Store screenshots at 1290×2796 (6.7"/6.9" iPhone: 430×932 points at 3×), light mode, from the demo data.
 * `npm run screenshots` writes them to app-store-screenshots/ (CI uploads them as an artifact).
 */
const OUT = "app-store-screenshots";

test.use({
  storageState: AUTH_FILE,
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "light",
  reducedMotion: "reduce",
});

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

const shot = (name: string) => ({ path: `${OUT}/${name}.png`, fullPage: false });

test("1 your turn", async ({ page }) => {
  await openGroup(page, "Demo flat");
  await page.waitForLoadState("networkidle");
  await page.screenshot(shot("1-your-turn"));
});

test("2 make a call", async ({ page }) => {
  await openGroup(page, "Demo flat");
  await page.getByRole("button", { name: "New call" }).click();
  const sheet = page.getByRole("dialog", { name: "New call" });
  await sheet.getByLabel("Your call").fill("Who’ll be late to Saturday’s dinner?");
  await sheet.getByRole("radio", { name: "Someone" }).click();
  await page.waitForTimeout(400);
  await page.screenshot(shot("2-make-a-call"));
});

test("3 called it", async ({ page }) => {
  await openGroup(page, "Demo flat");
  const card = page.locator(".card", { hasText: "Will the pizza arrive within 30 minutes?" });
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -140));
  await page.waitForTimeout(400);
  await page.screenshot(shot("3-called-it"));
});

test("4 ranking", async ({ page }) => {
  const url = await openGroup(page, "Demo flat");
  await page.goto(url + "/ranking");
  await page.waitForLoadState("networkidle");
  await page.screenshot(shot("4-ranking"));
});
