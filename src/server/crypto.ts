import { createHash, randomBytes } from "node:crypto";

/** A URL-safe random token. 32 bytes = 256 bits by default. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens are high-entropy, so a plain SHA-256 is enough (no salt or slow hash needed). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
