import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Words that make a friendly prediction game read like gambling. Never in UI text, emails or code. */
const BANNED = ["bet", "bets", "betting", "wager", "stake", "stakes", "odds", "payout", "gamble", "gambling", "jackpot", "casino", "bookie"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}

describe("wording", () => {
  it("never uses gambling words in the app", () => {
    const pattern = new RegExp(`\\b(${BANNED.join("|")})\\b`, "i");
    const hits = files("src").flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ f, line: i + 1, text: line.trim() }))
        .filter((l) => pattern.test(l.text)),
    );
    expect(hits).toEqual([]);
  });
});
