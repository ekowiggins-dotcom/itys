/**
 * App Review access. Sign in with Apple is the only way to sign in, and a fresh Apple account has no groups, so
 * Apple's reviewers get one more door: on the sign-in screen, "App Review demo" takes a secret code and signs
 * straight into one configured account (REVIEW_EMAIL; no email is sent) with a ready-made demo group.
 * Off, and hidden, unless REVIEW_EMAIL and REVIEW_CODE (16+ characters) are both set.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { User } from "./auth";
import { startSession } from "./auth";
import { createCall, pick } from "./calls";
import { calls, groups, members, users } from "./db/schema";
import type { Db } from "./db/types";
import { AppError } from "./errors";
import { createGroup, groupForMember, joinGroup } from "./groups";
import { proposeResult, runDueCalls } from "./lifecycle";
import { hit, LIMITS } from "./rate-limit";

const DEMO_GROUP = "App Review demo";

export function reviewConfig() {
  const email = process.env.REVIEW_EMAIL?.trim().toLowerCase();
  const code = process.env.REVIEW_CODE ?? "";
  return email && code.length >= 16 ? { email, code } : null;
}

const same = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** Signs the review account in with its code. Returns a session token. */
export async function reviewLogin(db: Db, code: string, ip: string, now = new Date()) {
  await hit(db, LIMITS.loginByIp, ip, now);
  const cfg = reviewConfig();
  // Same answer for every failure, so the code can't be probed.
  if (!cfg || !same(code.trim(), cfg.code)) throw new AppError("invalid", "That code isn't right.");
  const user = await ensureReviewUser(db);
  const { sessionToken, expiresAt } = await startSession(db, user.id, now);
  return { sessionToken, expiresAt, user };
}

async function userFor(db: Db, email: string, name: string): Promise<User> {
  await db.insert(users).values({ email, name }).onConflictDoNothing({ target: users.email });
  const [u] = await db.select().from(users).where(eq(users.email, email));
  return { id: u.id, email: u.email, name: u.name };
}

async function ensureReviewUser(db: Db) {
  return userFor(db, reviewConfig()!.email, "Reviewer");
}

/**
 * Makes sure the review account has a demo group with friends and calls at every stage. Idempotent: does
 * nothing if the group is already there. Called at server start when review access is configured.
 */
export async function ensureReviewDemo(db: Db, now = new Date()) {
  if (!reviewConfig()) return;
  const reviewer = await ensureReviewUser(db);
  const existing = await db
    .select({ id: groups.id })
    .from(groups)
    .innerJoin(members, and(eq(members.groupId, groups.id), eq(members.userId, reviewer.id), isNull(members.leftAt)))
    .where(eq(groups.name, DEMO_GROUP));
  if (existing.length) return;

  const H = 3600_000;
  const ago = (h: number) => new Date(now.getTime() - h * H);
  const ahead = (h: number) => new Date(now.getTime() + h * H);
  // Fake friends on a reserved domain: they can't receive email or sign in.
  const mia = await userFor(db, "mia@review.invalid", "Mia");
  const leo = await userFor(db, "leo@review.invalid", "Leo");
  const zoe = await userFor(db, "zoe@review.invalid", "Zoe");

  const start = ago(24 * 5);
  const groupId = await createGroup(db, reviewer, { name: DEMO_GROUP, timeZone: "UTC", displayName: "Reviewer", color: "violet" }, start);
  const invite = (await groupForMember(db, reviewer, groupId)).inviteToken!;
  for (const [u, n] of [[mia, "Mia"], [leo, "Leo"], [zoe, "Zoe"]] as const) await joinGroup(db, u, invite, n, "review", start);

  // Open: the reviewer can pick.
  await createCall(db, mia, groupId, { text: "Who’ll be late to Saturday’s dinner?", kind: "member", lockAt: ahead(30), eventAt: ahead(48) }, ago(1));
  const yesNo = await createCall(db, leo, groupId, { text: "Will it rain on the picnic?", kind: "yes_no", lockAt: ahead(20), eventAt: ahead(26) }, ago(2));
  await pick(db, zoe, yesNo, "yes", ago(1));

  // Settled: the reviewer called it (shows the stamp and points).
  const won = await createCall(db, zoe, groupId, { text: "Will the pizza arrive within 30 minutes?", kind: "yes_no", lockAt: ago(30), eventAt: ago(29) }, ago(40));
  await pick(db, reviewer, won, "yes", ago(35));
  await pick(db, mia, won, "no", ago(35));
  await pick(db, leo, won, "no", ago(35));
  await runDueCalls(db, ago(30));
  const [w] = await db.select({ settlerId: calls.settlerId }).from(calls).where(eq(calls.id, won));
  const settler = [reviewer, mia, leo, zoe].find((u) => u.id === w.settlerId)!;
  await proposeResult(db, settler, won, "yes", ago(28));
  await runDueCalls(db, now);
}
