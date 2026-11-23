import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FACE_COLORS, GROUP_COLORS } from "@/lib/faces";

/**
 * Checks the colour pairs the app actually uses against WCAG 2.2 contrast:
 * 4.5:1 for normal text, 3:1 for large/bold text (18.66px bold or 24px+) and UI parts.
 * Token values are read from globals.css, so this test follows the real styles.
 */
const css = readFileSync("src/app/globals.css", "utf8");

function tokens(block: string) {
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
}
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)"));
const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const darkBlock = css.slice(darkStart, css.indexOf("color-scheme: dark", darkStart));
const light = tokens(rootBlock);
const dark = { ...light, ...tokens(darkBlock) };

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const TEXT = 4.5;
const LARGE = 3;

/** [foreground token or hex, background token or hex, minimum, what it is] */
const pairs: [string, string, number, string][] = [
  ["text", "bg", TEXT, "body text on the page"],
  ["text", "surface", TEXT, "text on cards"],
  ["text-2", "surface", TEXT, "secondary text on cards"],
  ["muted", "bg", TEXT, "muted text on the page"],
  ["muted", "surface", TEXT, "muted text on cards"],
  ["muted", "surface-2", TEXT, "muted text on chips and tags"],
  ["soon", "soon-bg", TEXT, "'soon' chips"],
  ["later", "later-bg", TEXT, "'later' chips and banners"],
  ["done", "done-bg", TEXT, "'done' chips"],
  ["danger", "surface", TEXT, "error and destructive text"],
  ["brand-ink", "lime", TEXT, "primary buttons"],
  ["edge", "bg", LARGE, "strong outlines on the page"],
  ["line-2", "surface", 1.3, "input borders (decorative, paired with labels)"],
];

const val = (t: Record<string, string>, k: string) => (k.startsWith("#") ? k : t[k]);

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("%s theme", (_name, t) => {
  it.each(pairs)("%s on %s is readable (%s, %s)", (fg, bg, min) => {
    expect(val(t, fg), `missing token ${fg}`).toBeTruthy();
    expect(val(t, bg), `missing token ${bg}`).toBeTruthy();
    expect(contrast(val(t, fg), val(t, bg))).toBeGreaterThanOrEqual(min);
  });
});

describe("people and badges", () => {
  it("keeps initials (ink) readable on every face colour", () => {
    for (const c of FACE_COLORS) expect(contrast("#17201b", c), c).toBeGreaterThanOrEqual(TEXT);
  });
  it("keeps ink text readable on every group colour (share cards, group header text)", () => {
    for (const c of Object.values(GROUP_COLORS)) expect(contrast("#17201b", c), c).toBeGreaterThanOrEqual(LARGE);
  });
  it("keeps badge numbers readable (white bold text on the badge colour)", () => {
    expect(contrast("#ffffff", light.badge)).toBeGreaterThanOrEqual(TEXT);
  });
});
