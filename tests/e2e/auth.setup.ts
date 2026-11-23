import { mkdirSync } from "node:fs";
import { test as setup } from "@playwright/test";
import { AUTH_FILE, signIn } from "./helpers";

setup("sign in as the demo user", async ({ page }) => {
  await signIn(page);
  mkdirSync("tests/e2e/.auth", { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
