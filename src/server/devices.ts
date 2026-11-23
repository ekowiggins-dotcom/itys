/**
 * The iOS app's server side: registering phones for push, and the home-screen widget's read-only token
 * and summary.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { User } from "./auth";
import { callsForMember } from "./call-views";
import { hashToken, randomToken } from "./crypto";
import { devices, members, widgetTokens, users } from "./db/schema";
import type { Db } from "./db/types";
import { AppError } from "./errors";
import { reviewQueue } from "./moderation";

/** APNs device tokens are 64+ hex characters. */
const TOKEN = /^[0-9a-fA-F]{64,200}$/;

/** Registers this phone for push, tied to the current session (signing out stops pushes to it). */
export async function registerDevice(db: Db, user: User, sessionToken: string, deviceToken: string, now = new Date()) {
  if (!TOKEN.test(deviceToken)) throw new AppError("invalid", "That isn't a push token.");
  const sessionHash = hashToken(sessionToken);
  // A token belongs to one phone: if someone else signs in on it, it moves to them.
  await db
    .insert(devices)
    .values({ token: deviceToken, userId: user.id, sessionHash, createdAt: now })
    .onConflictDoUpdate({ target: devices.token, set: { userId: user.id, sessionHash, disabledAt: null } });
}

/** A new read-only widget token, replacing any older one. Shown once; only its hash is kept. */
export async function createWidgetToken(db: Db, user: User, now = new Date()) {
  const token = randomToken();
  await db.delete(widgetTokens).where(eq(widgetTokens.userId, user.id));
  await db.insert(widgetTokens).values({ tokenHash: hashToken(token), userId: user.id, createdAt: now });
  return token;
}

export type WidgetSummary = { needsYou: number; openCalls: number; nextLockAt: string | null };

/**
 * What the widget shows: how many calls need you, how many are open that you haven't picked, and when the next
 * one closes. Counts only: nothing personal on a lock screen. Null for an unknown token.
 */
export async function widgetSummary(db: Db, token: string | null, now = new Date()): Promise<WidgetSummary | null> {
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(widgetTokens)
    .innerJoin(users, eq(users.id, widgetTokens.userId))
    .where(eq(widgetTokens.tokenHash, hashToken(token)));
  if (!row) return null;
  const user: User = { id: row.user.id, email: row.user.email, name: row.user.name };
  const groupsIn = await db
    .select({ groupId: members.groupId })
    .from(members)
    .where(and(eq(members.userId, user.id), isNull(members.leftAt)));

  let needsYou = (await reviewQueue(db, user)).length;
  let openCalls = 0;
  let next: Date | null = null;
  for (const { groupId } of groupsIn) {
    for (const c of await callsForMember(db, user, groupId, now)) {
      if (c.canSettle || c.canDispute || c.canVote) needsYou++;
      if (c.canPick && !c.myPick) {
        openCalls++;
        if (!next || c.lockAt < next) next = c.lockAt;
      }
    }
  }
  return { needsYou, openCalls, nextLockAt: next?.toISOString() ?? null };
}

