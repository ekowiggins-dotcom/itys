import { expect, test } from "@playwright/test";
import { APP_USER_AGENT } from "./app-agent";
import { audit, AUTH_FILE, openGroup } from "./helpers";

/**
 * The whole call-invite flow: Ada shares an open call; a friend who has never used Who’ll opens the link. In a web
 * browser they see the call and "get the app"; in the app they tap a pick, sign in, and land in the group with it.
 */
test("a friend joins a group through a shared call, with their pick", async ({ browser }, info) => {
  const ada = await browser.newContext({ storageState: AUTH_FILE });
  const adaPage = await ada.newPage();
  await openGroup(adaPage, "Çılgın Kuzenler");
  const card = adaPage.locator(".call").filter({ hasText: "Kim düğüne en son gelecek?" });
  await card.getByRole("button", { name: "Invite a friend to call it" }).click();
  // No share sheet in this browser, so the link is shown to copy.
  const url = (await card.locator(".invite").textContent())!.trim();
  expect(url).toMatch(/\/c\/[A-Za-z0-9_-]{22}$/);
  await ada.close();

  const friend = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await friend.newPage();
  await page.goto(new URL(url).pathname);
  await expect(page.getByText("Kim düğüne en son gelecek?")).toBeVisible();
  await expect(page.getByText(/Ada invited you to/)).toBeVisible();
  await audit(page, info, "call-invite", 390);

  await page.getByRole("link", { name: /Şükrü/ }).click();
  await page.waitForURL(/\?pick=/);
  // A web browser can't sign in: it's sent to the App Store, and the invite opens in the app afterwards.
  await expect(page.getByRole("heading", { name: /in the app/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for iPhone" })).toHaveAttribute("href", /apps\.apple\.com/);
  await audit(page, info, "call-invite-get-the-app", 390);
  const picked = new URL(page.url()).pathname + new URL(page.url()).search;
  await friend.close();

  // The same link in the app.
  const app = await browser.newContext({ viewport: { width: 390, height: 800 }, userAgent: APP_USER_AGENT });
  const appPage = await app.newPage();
  await appPage.goto(picked);
  await expect(appPage.getByText(/Sign in to join/)).toBeVisible();
  await audit(appPage, info, "call-invite-picked", 390);

  await appPage.getByRole("link", { name: "Other ways to sign in" }).click();
  await appPage.getByText("Use email instead").click();
  await appPage.getByLabel("Email").fill(`friend${Date.now()}@example.com`);
  await appPage.getByRole("button", { name: "Send link" }).click();
  await appPage.getByRole("link", { name: "open the sign-in link" }).click();
  await appPage.getByRole("button", { name: "Continue" }).click();
  await appPage.getByLabel("Name").fill("Egemen");
  await appPage.getByRole("button", { name: "Continue" }).click();

  await appPage.waitForURL(/\/c\/[A-Za-z0-9_-]{22}\?pick=/);
  await appPage.getByRole("button", { name: /Join and lock in Şükrü/ }).click();
  await appPage.waitForURL(/\/groups\/[0-9a-f-]{36}$/);
  const mine = appPage.locator(".call").filter({ hasText: "Kim düğüne en son gelecek?" }).locator(".person.mine");
  await expect(mine).toContainText("Şükrü");
  await app.close();
});

test("in a web browser, sign-in and sign-in links send people to the app", async ({ page }, info) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Get Who’ll on your iPhone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Apple" })).toHaveCount(0);
  await expect(page.getByText("Use email instead")).toHaveCount(0);
  await page.goto("/auth/verify?token=abc");
  await expect(page.getByRole("heading", { name: "Open this link on your iPhone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await audit(page, info, "verify-in-browser", 390);
});

test("a closed or unknown call invite says so", async ({ page }, info) => {
  await page.goto("/c/AAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "This invite has closed" })).toBeVisible();
  await audit(page, info, "bad-call-invite", 390);
});
