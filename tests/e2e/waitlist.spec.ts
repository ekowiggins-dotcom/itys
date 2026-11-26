import { expect, test } from "@playwright/test";
import { audit } from "./helpers";

// The first visit to a fresh dev server compiles the page and may reload it once: let that settle first.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/waitlist");
  await page.waitForLoadState("networkidle");
  await page.close();
});

test("joining the waitlist in English, from an ad link", async ({ page }, info) => {
  await page.goto("/waitlist?utm_source=instagram&utm_campaign=demand-test&utm_content=reel-en");
  await expect(page.getByRole("heading", { name: "Join the waitlist" })).toBeVisible();
  await audit(page, info, "waitlist-en", 390);
  await page.getByLabel("Email").fill(`en${Date.now()}@example.com`);
  await page.getByRole("radio", { name: "5–8" }).check();
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.getByRole("heading", { name: "You’re on the list!" })).toBeVisible();
  await audit(page, info, "waitlist-en-thanks", 390);
});

test("joining the waitlist in Turkish (?lang=tr)", async ({ page }, info) => {
  await page.goto("/waitlist?lang=tr&src=ig-tr");
  await expect(page.getByRole("heading", { name: "Bekleme listesine katıl" })).toBeVisible();
  await audit(page, info, "waitlist-tr", 390);
  await page.getByLabel("E-posta").fill(`tr${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Bekleme listesine katıl" }).click();
  await expect(page.getByRole("heading", { name: "Listedesin!" })).toBeVisible();
});

test("the browser's language picks Turkish", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "tr-TR" });
  const page = await ctx.newPage();
  await page.goto("/waitlist");
  await expect(page.getByRole("heading", { name: "Bekleme listesine katıl" })).toBeVisible();
  await ctx.close();
});
