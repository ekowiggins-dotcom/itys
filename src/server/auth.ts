import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { hashToken, randomToken } from "./crypto";
import { sessions, users, widgetTokens } from "./db/schema";
import type { Db, Tx } from "./db/types";

export const SESSION_TTL_MS = 30 * 86400_000;
/** A session's expiry is pushed forward at most once per day, so reading pages doesn't write every time. */
export const SESSION_REFRESH_MS = 86400_000;

/** email is null for people who signed in with Apple and hid it. */
export type User = { id: string; email: string | null; name: string | null; emailAlerts?: boolean };

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(30, "Keep it to 30 characters.")
  .regex(/^[\p{L}\p{N} .'-]+$/u, "Use letters, numbers, spaces, dots, apostrophes or dashes.");

/** Starts a session for a user (Sign in with Apple, App Review). Only a hash of the token is stored. */
export async function startSession(db: Db | Tx, userId: string, now = new Date()) {
  const sessionToken = randomToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: hashToken(sessionToken), userId, expiresAt, lastSeenAt: now });
  return { sessionToken, expiresAt };
}

/** Looks up the signed-in user. Expired sessions count as signed out. Slides expiry at most once a day. */
export async function userForSession(db: Db, token: string | undefined, now = new Date()): Promise<User | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ user: users, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)));
  if (!row) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > SESSION_REFRESH_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
      .where(eq(sessions.tokenHash, tokenHash));
  }
  return toUser(row.user);
}

export async function setName(db: Db, user: User, rawName: string) {
  const name = nameSchema.parse(rawName);
  await db.update(users).set({ name }).where(eq(users.id, user.id));
  return name;
}

export async function setEmailAlerts(db: Db, user: User, on: boolean) {
  await db.update(users).set({ emailAlerts: on }).where(eq(users.id, user.id));
}

export async function logout(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Signs out on every device. */
export async function logoutEverywhere(db: Db, user: User) {
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await db.delete(widgetTokens).where(eq(widgetTokens.userId, user.id)); // the widget stops too
}

function toUser(u: typeof users.$inferSelect): User {
  return { id: u.id, email: u.email, name: u.name, emailAlerts: u.emailAlerts };
}
