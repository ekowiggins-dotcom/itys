/**
 * Keeping calls about real people kind.
 *
 * - Protect first, review after: a call is hidden at once when the person it's about asks, or when 2 members
 *   report it. Hidden calls are shown to nobody and their clock (reminders, settling) is paused.
 * - A reviewer then restores it or removes it for good. The reviewer is the admin, unless the admin wrote the
 *   call or it's about them; then it's the longest-standing other member. Removed calls are called off and
 *   any points from them are taken back.
 * - Blocking someone hides their calls from you, mutes their notifications, and stops them making calls about you.
 * - Admins can remove a member, who then can't rejoin until let back in.
 */
import { and, asc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import type { User } from "./auth";
import { callForUpdate } from "./calls";
import { blocks, calls, groups, members, reports, scores } from "./db/schema";
import type { Db, Tx } from "./db/types";
import { AppError, notFound } from "./errors";
import { requireMember } from "./groups";
import { advance, nextActionAt } from "./lifecycle";
import { emit } from "./notify";
import { z } from "zod";

export const REPORTS_TO_HIDE = 2;
export type ReportReason = "about_me" | "hurtful" | "private" | "spam" | "other";
type Call = typeof calls.$inferSelect;

/** Who reviews a hidden call: the admin, unless they wrote it or it's about them. */
export async function reviewerFor(tx: Db | Tx, c: Pick<Call, "groupId" | "authorId" | "subjectId">) {
  const rows = await tx
    .select({ userId: members.userId, role: members.role })
    .from(members)
    .where(and(eq(members.groupId, c.groupId), isNull(members.leftAt)))
    .orderBy(asc(members.joinedAt));
  const ok = (id: string) => id !== c.authorId && id !== c.subjectId;
  const admin = rows.find((r) => r.role === "admin");
  if (admin && ok(admin.userId)) return admin.userId;
  return rows.find((r) => ok(r.userId))?.userId ?? null;
}

async function hide(tx: Tx, c: Call, now: Date) {
  await tx.update(calls).set({ moderation: "hidden", hiddenAt: now, nextActionAt: null }).where(eq(calls.id, c.id));
  const reviewer = await reviewerFor(tx, c);
  if (reviewer) await emit(tx, { type: "review_needed", groupId: c.groupId, callId: c.id, userIds: [reviewer], now });
}

/**
 * Reports a call. The person it's about hides it straight away ("about_me"); anyone else's report counts
 * towards REPORTS_TO_HIDE. Returns whether the call is now hidden.
 */
export async function reportCall(db: Db, user: User, callId: string, reason: ReportReason, now = new Date()) {
  return db.transaction(async (tx) => {
    const c = await callForUpdate(tx, user, callId);
    if (c.moderation !== "visible") return true;
    if (c.authorId === user.id) throw new AppError("invalid", "You wrote this call. You can cancel it before picks close.");
    const isSubject = c.subjectId === user.id;
    await tx
      .insert(reports)
      .values({ callId, userId: user.id, reason: isSubject ? "about_me" : reason, createdAt: now })
      .onConflictDoNothing();
    const all = await tx.select({ userId: reports.userId }).from(reports).where(eq(reports.callId, callId));
    if (isSubject || all.length >= REPORTS_TO_HIDE) {
      await hide(tx, c, now);
      return true;
    }
    return false;
  });
}

export type ReviewItem = { callId: string; groupId: string; groupName: string; text: string; author: string; subject: string | null; reasons: ReportReason[]; hiddenAt: Date | null };

/** Hidden calls this user is the reviewer for. */
export async function reviewQueue(db: Db, user: User): Promise<ReviewItem[]> {
  const mine = await db
    .select({ groupId: members.groupId })
    .from(members)
    .where(and(eq(members.userId, user.id), isNull(members.leftAt)));
  if (mine.length === 0) return [];
  const hidden = await db
    .select({ call: calls, groupName: groups.name })
    .from(calls)
    .innerJoin(groups, eq(groups.id, calls.groupId))
    .where(and(eq(calls.moderation, "hidden"), inArray(calls.groupId, mine.map((m) => m.groupId))));
  const out: ReviewItem[] = [];
  for (const { call, groupName } of hidden) {
    if ((await reviewerFor(db, call)) !== user.id) continue;
    const names = await db
      .select({ userId: members.userId, name: members.displayName })
      .from(members)
      .where(eq(members.groupId, call.groupId));
    const nameOf = (id: string | null) => (id ? (names.find((n) => n.userId === id)?.name ?? "Former member") : null);
    const reasons = await db.select({ reason: reports.reason }).from(reports).where(eq(reports.callId, call.id));
    out.push({
      callId: call.id,
      groupId: call.groupId,
      groupName,
      text: call.text,
      author: nameOf(call.authorId) ?? "Former member",
      subject: nameOf(call.subjectId),
      reasons: [...new Set(reasons.map((r) => r.reason))],
      hiddenAt: call.hiddenAt,
    });
  }
  return out;
}

/** The reviewer restores a hidden call, or removes it for good. */
export async function reviewCall(db: Db, user: User, callId: string, decision: "restore" | "remove", now = new Date()) {
  await db.transaction(async (tx) => {
    if (!z.uuid().safeParse(callId).success) throw notFound("Call");
    const [c] = await tx.select().from(calls).where(eq(calls.id, callId)).for("update");
    if (!c) throw notFound("Call");
    await requireMember(tx, user, c.groupId);
    if (c.moderation !== "hidden") throw new AppError("conflict", "This call isn't waiting for a review.");
    if ((await reviewerFor(tx, c)) !== user.id) throw new AppError("forbidden", "Someone else reviews this call.");

    if (decision === "restore") {
      await tx.update(calls).set({ moderation: "visible", reviewedBy: user.id, reviewedAt: now }).where(eq(calls.id, callId));
      // Resume its clock: catch up on anything that came due while it was hidden.
      const restored = { ...c, moderation: "visible" as const };
      await tx.update(calls).set({ nextActionAt: nextActionAt(restored) }).where(eq(calls.id, callId));
      await advance(tx, restored, now);
      await tx.delete(reports).where(eq(reports.callId, callId));
      return;
    }
    await tx
      .update(calls)
      .set({
        moderation: "removed",
        status: c.status === "cancelled" ? "cancelled" : "void",
        voidReason: "removed",
        settledAt: c.settledAt ?? now,
        nextActionAt: null,
        reviewedBy: user.id,
        reviewedAt: now,
      })
      .where(eq(calls.id, callId));
    await tx.delete(scores).where(eq(scores.callId, callId)); // points from a removed call are taken back
    await emit(tx, { type: "call_removed", groupId: c.groupId, callId, userIds: [c.authorId], now });
  });
}

// --- Blocking -------------------------------------------------------------------------------------------

export async function blockUser(db: Db, user: User, targetId: string, now = new Date()) {
  if (!z.uuid().safeParse(targetId).success || targetId === user.id) throw new AppError("invalid", "You can't block that person.");
  // Only people you share (or shared) a group with can be blocked: no probing user ids.
  const shared = await db
    .select({ g: members.groupId })
    .from(members)
    .where(and(eq(members.userId, targetId), inArray(members.groupId, db.select({ g: members.groupId }).from(members).where(eq(members.userId, user.id)))))
    .limit(1);
  if (shared.length === 0) throw notFound("Person");
  await db.insert(blocks).values({ blockerId: user.id, blockedId: targetId, createdAt: now }).onConflictDoNothing();
}

export async function unblockUser(db: Db, user: User, targetId: string) {
  if (!z.uuid().safeParse(targetId).success) return;
  await db.delete(blocks).where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, targetId)));
}

/** People this user blocked, with a name from a group they share. */
export async function blockedPeople(db: Db, user: User) {
  const rows = await db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, user.id));
  if (rows.length === 0) return [];
  const names = await db
    .select({ userId: members.userId, name: members.displayName })
    .from(members)
    .where(inArray(members.userId, rows.map((r) => r.id)));
  return rows.map((r) => ({ userId: r.id, name: names.find((n) => n.userId === r.id)?.name ?? "Former member" }));
}

export async function blockedIds(db: Db | Tx, userId: string) {
  return new Set((await db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, userId))).map((r) => r.id));
}

/** True if `a` blocked `b` (so `b` can't make calls about `a`). */
export async function hasBlocked(db: Db | Tx, a: string, b: string) {
  const [row] = await db.select().from(blocks).where(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)));
  return !!row;
}

// --- Removing members -----------------------------------------------------------------------------------

export async function removeMember(db: Db, admin: User, groupId: string, targetId: string, now = new Date()) {
  await db.transaction(async (tx) => {
    const me = await requireMember(tx, admin, groupId);
    if (me.role !== "admin") throw new AppError("forbidden", "Only the group admin can remove people.");
    if (targetId === admin.id) throw new AppError("invalid", "To leave, use Leave group.");
    const updated = await tx
      .update(members)
      .set({ leftAt: now, bannedAt: now, role: "member" })
      .where(and(eq(members.groupId, groupId), eq(members.userId, targetId), isNull(members.leftAt), ne(members.userId, admin.id)))
      .returning({ userId: members.userId });
    if (updated.length === 0) throw notFound("Member");
  });
}

/** Lets a removed member join again (with the invite link). */
export async function allowBack(db: Db, admin: User, groupId: string, targetId: string) {
  const me = await requireMember(db, admin, groupId);
  if (me.role !== "admin") throw new AppError("forbidden", "Only the group admin can do that.");
  await db.update(members).set({ bannedAt: null }).where(and(eq(members.groupId, groupId), eq(members.userId, targetId)));
}

export async function removedMembers(db: Db, admin: User, groupId: string) {
  const me = await requireMember(db, admin, groupId);
  if (me.role !== "admin") return [];
  return db
    .select({ userId: members.userId, name: members.displayName })
    .from(members)
    .where(and(eq(members.groupId, groupId), isNotNull(members.bannedAt)));
}
