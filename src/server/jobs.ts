import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";
import { runDueCalls } from "./lifecycle";

/** Runs every due step once. Called by the cron endpoint, the worker, and the in-process loop. */
export async function runJobsOnce(now = new Date()) {
  const db = await getDb();
  return { calls: await runDueCalls(db, now) };
}

/** Constant-time check of the cron secret (hashing first makes lengths equal). */
export function cronAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !header?.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
