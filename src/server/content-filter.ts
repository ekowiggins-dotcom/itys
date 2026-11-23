import naughty from "naughty-words";
import { AppError } from "./errors";

/**
 * First line of defence for call text and options: slurs, sexual and obscene words aren't allowed.
 * Word lists: "List of Dirty, Naughty, Obscene, and Otherwise Bad Words" (English and Turkish) via the
 * naughty-words package, CC BY 4.0 (https://github.com/LDNOOBW), plus a few of our own.
 * Matching is by whole word (or whole phrase) after normalising common disguises, so innocent words that merely
 * contain a bad one ("sextant", "Scunthorpe") pass. Reports and review remain the real safety net.
 */

/** Extra entries the lists don't have. */
const EXTRA = ["nudes", "sex tape", "sexting", "onlyfans", "whore"];

/**
 * Entries we deliberately allow: everyday words that collide across languages ("am" is English for "I am"),
 * and mild banter that's fine between friends. Strong swearing, slurs and sexual terms stay blocked.
 */
const ALLOW = new Set(["am", "suck", "butt", "xx"]);

/**
 * Normalises common evasions: case, repeated letters, digits used as letters, separators.
 * Accents are kept on purpose: in Turkish they change the word ("şık" means stylish, "göt" isn't "got").
 */
export function normalise(text: string, locale: "en" | "tr" = "tr") {
  return text
    .toLocaleLowerCase(locale)
    .normalize("NFC")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[._*\-]+/g, "");
}

const words = (s: string, locale: "en" | "tr" = "tr") =>
  normalise(s, locale).replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();

const ENTRIES = [...naughty.en.map((e) => words(e, "en")), ...naughty.tr.map((e) => words(e, "tr")), ...EXTRA.map((e) => words(e, "en"))]
  .filter((e) => e.length > 1 && !ALLOW.has(e));
const SINGLE = new Set(ENTRIES.filter((e) => !e.includes(" ")));
const PHRASES = ENTRIES.filter((e) => e.includes(" "));

/** Checks the text lowercased both ways: Turkish turns "I" into "ı", English keeps "i" ("DICK" must still match). */
export function findBlocked(text: string): string | null {
  for (const locale of ["tr", "en"] as const) {
    const t = words(text, locale);
    for (const token of t.split(" ")) if (SINGLE.has(token)) return token;
    const padded = ` ${t} `;
    const phrase = PHRASES.find((p) => padded.includes(` ${p} `));
    if (phrase) return phrase;
  }
  return null;
}

export function checkCallText(...texts: (string | undefined)[]) {
  for (const t of texts) {
    if (t && findBlocked(t)) {
      throw new AppError("invalid", "That wording isn't allowed. Calls should be fun for everyone, including the people in them.");
    }
  }
}
