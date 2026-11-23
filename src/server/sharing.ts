/**
 * Public share links for results. Rules (also in visibility.ts, tested in the visibility table):
 * - Only settled calls that are still visible can be shared, and only by a current member.
 * - A call about a person can only be shared by that person; a "who" call only by the person it named.
 * - The public page shows the call, the answer, how many picked and how many called it, and the sharer's own
 *   result. It never shows who picked what, the group's name, or anyone else's name.
 * - Every view re-checks these rules, so removing a call, leaving the group or deleting the account takes the
 *   link down.
 */
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { User } from "./auth";
import { randomToken } from "./crypto";
import { calls, members, picks, scores, shareLinks } from "./db/schema";
import type { Db } from "./db/types";
import { AppError, notFound } from "./errors";
import { requireMember } from "./groups";
import { hit, LIMITS } from "./rate-limit";
import { callVisibility, publicShareAllowed } from "./visibility";

export async function createShareLink(db: Db, user: User, callId: string, now = new Date()) {
  if (!z.uuid().safeParse(callId).success) throw notFound("Call");
  const [c] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!c) throw notFound("Call");
  await requireMember(db, user, c.groupId);
  if (!callVisibility(c, { userId: user.id, isMember: true }, now).canShare) {
    throw new AppError(
      "forbidden",
      c.status !== "settled" ? "You can share a call once it has a result." : "Only the person this call is about can share it.",
    );
  }
  const [existing] = await db
    .select({ token: shareLinks.token })
    .from(shareLinks)
    .where(and(eq(shareLinks.callId, callId), eq(shareLinks.createdBy, user.id)));
  if (existing) return existing.token;
  const token = randomToken(16);
  await db.insert(shareLinks).values({ token, callId, createdBy: user.id, createdAt: now }).onConflictDoNothing();
  const [row] = await db
    .select({ token: shareLinks.token })
    .from(shareLinks)
    .where(and(eq(shareLinks.callId, callId), eq(shareLinks.createdBy, user.id)));
  return row.token;
}

export type PublicResult = {
  text: string;
  answer: string;
  pickers: number;
  rightCount: number;
  sharerName: string;
  /** The sharer's own outcome, theirs to share. Null if they didn't pick. */
  sharerCalledIt: boolean | null;
  sharerPoints: number | null;
};

/** What a public link shows, or null when it shouldn't show anything (any more). */
export async function publicResult(db: Db, token: string, ip: string | null, now = new Date()): Promise<PublicResult | null> {
  if (ip) await hit(db, LIMITS.shareViewByIp, ip, now);
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return null;
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token));
  if (!link) return null;
  const [c] = await db.select().from(calls).where(eq(calls.id, link.callId));
  if (!c) return null;
  const [sharer] = await db
    .select({ name: members.displayName })
    .from(members)
    .where(and(eq(members.groupId, c.groupId), eq(members.userId, link.createdBy), isNull(members.leftAt)));
  if (!publicShareAllowed({ ...c, sharedBy: link.createdBy, sharerIsMember: !!sharer })) return null;

  const pickRows = await db.select({ userId: picks.userId, optionKey: picks.optionKey }).from(picks).where(eq(picks.callId, c.id));
  const mine = pickRows.find((p) => p.userId === link.createdBy);
  const [myScore] = await db
    .select({ points: scores.points })
    .from(scores)
    .where(and(eq(scores.callId, c.id), eq(scores.userId, link.createdBy)));
  // For "who" calls the answer is the sharer (only they may share it), so their own name is the answer.
  const answer = c.kind === "member" ? sharer.name : (c.options.find((o) => o.key === c.result)?.label ?? "");
  return {
    text: c.text,
    answer,
    pickers: pickRows.length,
    rightCount: pickRows.filter((p) => p.optionKey === c.result).length,
    sharerName: sharer.name,
    sharerCalledIt: mine ? mine.optionKey === c.result : null,
    sharerPoints: myScore?.points ?? null,
  };
}

/** Invite previews for link unfurls: group name and size only (the same as the join page). */
export { invitePreview } from "./groups";
