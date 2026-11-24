import { lt, sql } from "drizzle-orm";
import { rateLimits } from "./db/schema";
import type { Db, Tx } from "./db/types";
import { AppError } from "./errors";

export type Limit = { name: string; max: number; windowSeconds: number };

/** The limits used across the app, in one place. */
export const LIMITS = {
  loginByIp: { name: "login:ip", max: 10, windowSeconds: 3600 },
  loginByEmail: { name: "login:email", max: 5, windowSeconds: 3600 },
  createGroup: { name: "group:create", max: 5, windowSeconds: 3600 },
  joinByIp: { name: "group:join:ip", max: 20, windowSeconds: 3600 },
  invitePreviewByIp: { name: "invite:preview:ip", max: 60, windowSeconds: 3600 },
  createCall: { name: "call:create", max: 20, windowSeconds: 86400 },
  shareViewByIp: { name: "share:view:ip", max: 120, windowSeconds: 3600 },
  callInviteViewByIp: { name: "call-invite:view:ip", max: 120, windowSeconds: 3600 },
} satisfies Record<string, Limit>;

/**
 * Counts one hit for `subject` under `limit` and throws once the limit is exceeded.
 * Fixed windows: simple, cheap (one upsert) and good enough against abuse at this scale.
 */
export async function hit(db: Db | Tx, limit: Limit, subject: string, now = new Date()): Promise<void> {
  const windowMs = limit.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const key = `${limit.name}:${subject}`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  // Clean up expired windows now and then, instead of running a separate job.
  if (Math.random() < 0.01) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 2 * 86400_000)));
  }
  if (row.count > limit.max) {
    throw new AppError("rate_limited", "Too many attempts. Please wait a while and try again.");
  }
}
