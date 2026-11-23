import { AppError } from "./errors";

/**
 * A basic first line of defence for call text: explicit sexual terms aimed at a person aren't allowed.
 * This is deliberately small. Before launch, replace it with a maintained list (e.g. the LDNOOBW lists,
 * including Turkish) and keep reports + review as the real safety net: no word list catches everything.
 */
const BLOCKED = ["porn", "nude", "nudes", "naked", "sex tape", "sexting", "onlyfans", "slut", "whore", "rape"];

/** Normalises common evasions: case, accents, repeated letters, digits used as letters, separators. */
export function normalise(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[._*\-]+/g, "");
}

export function findBlocked(text: string): string | null {
  const t = ` ${normalise(text).replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ")} `;
  return BLOCKED.find((w) => t.includes(` ${w} `)) ?? null;
}

export function checkCallText(...texts: (string | undefined)[]) {
  for (const t of texts) {
    if (t && findBlocked(t)) {
      throw new AppError("invalid", "That wording isn't allowed. Calls should be fun for everyone, including the people in them.");
    }
  }
}
