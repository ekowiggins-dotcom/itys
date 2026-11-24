import { expect, test } from "@playwright/test";
import { audit, AUTH_FILE, openGroup } from "./helpers";

/**
 * The whole call-invite flow: Ada shares an open call; a friend who has never used Who’ll opens the link, taps a
 * pick, signs in, and lands in the group with that pick in.
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
  await expect(page.getByText("Sign in to join")).toBeVisible();
  await audit(page, info, "call-invite-picked", 390);

  await page.getByRole("link", { name: "Other ways to sign in" }).click();
  await page.getByText("Use email instead").click();
  await page.getByLabel("Email").fill(`friend${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Send link" }).click();
  await page.getByRole("link", { name: "open the sign-in link" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Name").fill("Egemen");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.waitForURL(/\/c\/[A-Za-z0-9_-]{22}\?pick=/);
  await page.getByRole("button", { name: /Join and lock in Şükrü/ }).click();
  await page.waitForURL(/\/groups\/[0-9a-f-]{36}$/);
  const mine = page.locator(".call").filter({ hasText: "Kim düğüne en son gelecek?" }).locator(".person.mine");
  await expect(mine).toContainText("Şükrü");
  await friend.close();
});

test("a closed or unknown call invite says so", async ({ page }, info) => {
  await page.goto("/c/AAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "This invite has closed" })).toBeVisible();
  await audit(page, info, "bad-call-invite", 390);
});
