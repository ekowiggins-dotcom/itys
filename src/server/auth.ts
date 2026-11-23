import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashToken, randomToken } from "./crypto";
import { loginTokens, sessions, users } from "./db/schema";
import type { Db } from "./db/types";
import { AppError } from "./errors";
import { hit, LIMITS } from "./rate-limit";

export const LOGIN_TOKEN_TTL_MS = 15 * 60_000;
export const SESSION_TTL_MS = 30 * 86400_000;
/** A session's expiry is pushed forward at most once per day, so reading pages doesn't write every time. */
export const SESSION_REFRESH_MS = 86400_000;

export type User = { id: string; email: string; name: string | null; emailAlerts?: boolean };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(30, "Keep it to 30 characters.")
  .regex(/^[\p{L}\p{N} .'-]+$/u, "Use letters, numbers, spaces, dots, apostrophes or dashes.");

/**
 * Starts sign-in: creates a one-time token for `email` and returns it so the caller can email a link.
 * The same response is given whether or not the email has an account, so it can't be used to probe accounts.
 */
export async function requestLogin(db: Db, rawEmail: string, ip: string, now = new Date()) {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new AppError("invalid", "Enter a valid email address.");
  const email = parsed.data;
  await hit(db, LIMITS.loginByIp, ip, now);
  await hit(db, LIMITS.loginByEmail, email, now);
  const token = randomToken();
  await db.insert(loginTokens).values({
    tokenHash: hashToken(token),
    email,
    expiresAt: new Date(now.getTime() + LOGIN_TOKEN_TTL_MS),
  });
  return { email, token };
}

/**
 * Finishes sign-in: consumes a login token (once), creates the user on first sign-in, and starts a session.
 * Returns the raw session token for the cookie; only its hash is stored.
 */
export async function completeLogin(db: Db, token: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(loginTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(loginTokens.tokenHash, hashToken(token)),
          isNull(loginTokens.usedAt),
          gt(loginTokens.expiresAt, now),
        ),
      )
      .returning({ email: loginTokens.email });
    if (!row) throw new AppError("invalid", "This sign-in link has expired or was already used. Request a new one.");

    await tx.insert(users).values({ email: row.email }).onConflictDoNothing({ target: users.email });
    const [user] = await tx.select().from(users).where(eq(users.email, row.email));

    const sessionToken = randomToken();
    await tx.insert(sessions).values({
      tokenHash: hashToken(sessionToken),
      userId: user.id,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      lastSeenAt: now,
    });
    return { sessionToken, user: toUser(user), expiresAt: new Date(now.getTime() + SESSION_TTL_MS) };
  });
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
}

function toUser(u: typeof users.$inferSelect): User {
  return { id: u.id, email: u.email, name: u.name, emailAlerts: u.emailAlerts };
}
