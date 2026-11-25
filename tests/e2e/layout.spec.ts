import { test } from "@playwright/test";
import { audit, AUTH_FILE, openGroup } from "./helpers";

const WIDTHS = [320, 390];
const SCHEMES = ["light", "dark"] as const;

type Screen = { name: string; open: (page: import("@playwright/test").Page) => Promise<void> };

const signedIn: Screen[] = [
  { name: "groups", open: async (p) => void (await p.goto("/groups")) },
  { name: "calls", open: async (p) => void (await openGroup(p, "Demo flat")) },
  {
    name: "new-call-sheet",
    open: async (p) => {
      await openGroup(p, "Demo flat");
      await p.getByRole("button", { name: "New call" }).click();
      await p.getByRole("dialog", { name: "New call" }).waitFor();
    },
  },
  {
    name: "card-menu",
    open: async (p) => {
      await openGroup(p, "Demo flat");
      await p.getByRole("button", { name: "More options" }).first().click();
      await p.getByRole("dialog", { name: "Call options" }).waitFor();
    },
  },
  { name: "ranking", open: async (p) => void (await p.goto((await openGroup(p, "Demo flat")) + "/ranking")) },
  { name: "group-tab", open: async (p) => void (await p.goto((await openGroup(p, "Demo flat")) + "/group")) },
  { name: "long-turkish", open: async (p) => void (await openGroup(p, "Çılgın Kuzenler")) },
  { name: "notifications", open: async (p) => void (await p.goto("/notifications")) },
  { name: "settings", open: async (p) => void (await p.goto("/settings")) },
  { name: "subscription", open: async (p) => void (await p.goto("/settings/subscription")) },
  { name: "paused-group", open: async (p) => void (await openGroup(p, "Five-a-side")) },
  {
    name: "paused-new-call",
    open: async (p) => {
      await openGroup(p, "Five-a-side");
      await p.getByRole("button", { name: "New call" }).click();
      await p.getByText("This group is paused until Bo renews").waitFor();
    },
  },
];

const signedOut: Screen[] = [
  { name: "landing", open: async (p) => void (await p.goto("/")) },
  { name: "login", open: async (p) => void (await p.goto("/login")) },
  { name: "bad-invite", open: async (p) => void (await p.goto("/join/AAAAAAAAAAAAAAAAAAAAAA")) },
  { name: "bad-share", open: async (p) => void (await p.goto("/r/AAAAAAAAAAAAAAAAAAAAAA")) },
  { name: "privacy", open: async (p) => void (await p.goto("/privacy")) },
  { name: "terms", open: async (p) => void (await p.goto("/terms")) },
  { name: "support", open: async (p) => void (await p.goto("/support")) },
];

for (const width of WIDTHS) {
  for (const scheme of SCHEMES) {
    test.describe(`${width}px ${scheme}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      });

      test.describe("signed in", () => {
        test.use({ storageState: AUTH_FILE });
        for (const s of signedIn) {
          test(s.name, async ({ page }, info) => {
            await s.open(page);
            await audit(page, info, `${s.name}-${width}-${scheme}`, width);
          });
        }
      });

      test.describe("signed out", () => {
        test.use({ storageState: { cookies: [], origins: [] } });
        for (const s of signedOut) {
          test(s.name, async ({ page }, info) => {
            await s.open(page);
            await audit(page, info, `${s.name}-${width}-${scheme}`, width);
          });
        }
      });
    });
  }
}
