import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

export const AUTH_FILE = "tests/e2e/.auth/ada.json";

/**
 * Signs in as the demo user. Sign in with Apple can't run in a test browser, so this uses the test-only
 * /api/test-sign-in (development with E2E_SIGN_IN=1 only).
 */
export async function signIn(page: Page, email = "ada@example.com", next = "/groups") {
  // The first visit to a fresh dev server compiles the page and may reload it once: let that settle first.
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.goto(`/api/test-sign-in?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

/** Opens a group from the groups list by name and returns its URL. */
export async function openGroup(page: Page, name: string) {
  await page.goto("/groups");
  await page.getByRole("link", { name: new RegExp(name) }).first().click();
  await page.waitForURL(/\/groups\/[0-9a-f-]{36}$/);
  return page.url();
}

/**
 * The checks every screen must pass:
 * - nothing scrolls sideways,
 * - every visible control is at least 44px tall (Apple's minimum tap size),
 * - no serious or critical accessibility problems (axe, WCAG 2.1 AA, including colour contrast).
 * A full-page screenshot is attached to the report for a human look.
 */
export async function audit(page: Page, info: TestInfo, label: string, width?: number) {
  await page.waitForLoadState("networkidle");
  // Let entrance animations settle so contrast is measured on final colours.
  await page.waitForTimeout(600);

  // On phones the browser widens its layout to fit content that's too wide (and zooms out), so compare
  // against the screen width we set, not just the window.
  const screenWidth = width ?? (await page.evaluate(() => window.innerWidth));
  const overflow = await page.evaluate(
    (w) => Math.max(document.documentElement.scrollWidth, window.innerWidth) - w,
    screenWidth,
  );
  if (overflow > 0) {
    // Name the elements sticking out, so a failure says what to fix.
    const culprits = await page.evaluate(
      (w) =>
        [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => el.getBoundingClientRect().right > w + 0.5 && el.getBoundingClientRect().width > 0)
          .slice(-5)
          .map((el) => `${el.tagName.toLowerCase()}.${el.className} → ${Math.round(el.getBoundingClientRect().right)}px`),
      screenWidth,
    );
    console.log(`${label} overflow:`, culprits);
  }
  expect(overflow, `${label}: page is ${overflow}px wider than the screen`).toBeLessThanOrEqual(0);

  const small = await page.evaluate(() => {
    const sel = 'button, [role="radio"], [role="tab"], select, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), .tabbar-item, .bell, summary';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const hiddenDialog = el.closest("dialog") && !el.closest("dialog[open]");
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && !hiddenDialog;
      })
      .filter((el) => el.getBoundingClientRect().height < 44)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`);
  });
  expect(small, `${label}: tap targets under 44px`).toEqual([]);

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = axe.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}×) e.g. ${v.nodes[0]?.target.join(" ")}`);
  expect(serious, `${label}: accessibility problems`).toEqual([]);

  await info.attach(`${label}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}
