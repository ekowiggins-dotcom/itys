import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { User } from "./auth";
import { calls, members, picks, type CallOption } from "./db/schema";
import type { Db, Tx } from "./db/types";
import { AppError, notFound } from "./errors";
import { requireMember } from "./groups";
import { hit, LIMITS } from "./rate-limit";
import { callVisibility, isLocked } from "./visibility";

/** Picks must stay open for at least this long after a call is made, so friends have time to see it. */
export const MIN_LOCK_LEAD_MS = 60 * 60_000;
export const MAX_LOCK_AHEAD_MS = 90 * 86400_000;
export const MAX_EVENT_AFTER_LOCK_MS = 90 * 86400_000;

const YES_NO: CallOption[] = [
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
];

export const newCallSchema = z
  .object({
    text: z.string().trim().min(5, "Write the call (at least 5 characters).").max(200, "Keep it to 200 characters."),
    kind: z.enum(["yes_no", "choice", "member"]),
    /** Only for "choice". */
    options: z.array(z.string().trim().max(40, "Keep each option to 40 characters.")).optional(),
    subjectId: z.uuid().optional(),
    lockAt: z.coerce.date(),
    eventAt: z.coerce.date(),
  })
  .refine((c) => c.eventAt.getTime() >= c.lockAt.getTime(), {
    message: "The result can't be known before picks close.",
    path: ["eventAt"],
  });
export type NewCall = z.input<typeof newCallSchema>;

/** Creates a call. Returns its id. */
export async function createCall(db: Db, user: User, groupId: string, input: NewCall, now = new Date()) {
  const data = newCallSchema.parse(input);
  if (data.lockAt.getTime() < now.getTime() + MIN_LOCK_LEAD_MS) {
    throw new AppError("invalid", "Picks need to stay open for at least an hour.");
  }
  if (data.lockAt.getTime() > now.getTime() + MAX_LOCK_AHEAD_MS) {
    throw new AppError("invalid", "Picks can close at most 90 days from now.");
  }
  if (data.eventAt.getTime() > data.lockAt.getTime() + MAX_EVENT_AFTER_LOCK_MS) {
    throw new AppError("invalid", "The result should be known within 90 days of picks closing.");
  }

  return db.transaction(async (tx) => {
    await requireMember(tx, user, groupId);
    const active = await tx
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.groupId, groupId), isNull(members.leftAt)))
      .orderBy(asc(members.joinedAt));
    const activeIds = new Set(active.map((m) => m.userId));

    if (data.subjectId && !activeIds.has(data.subjectId)) {
      throw new AppError("invalid", "The person this call is about must be in the group.");
    }

    let options: CallOption[];
    if (data.kind === "yes_no") options = YES_NO;
    else if (data.kind === "member") {
      // "Who will…?": every current member except the subject. Names are looked up when shown.
      options = active.filter((m) => m.userId !== data.subjectId).map((m) => ({ key: m.userId, label: "" }));
      if (options.length < 2) throw new AppError("invalid", "A 'who' call needs at least two people to choose from.");
    } else {
      const labels = (data.options ?? []).filter((o) => o.length > 0);
      const unique = new Set(labels.map((l) => l.toLowerCase()));
      if (labels.length < 2 || labels.length > 4) throw new AppError("invalid", "Give 2 to 4 options.");
      if (unique.size !== labels.length) throw new AppError("invalid", "Options must be different from each other.");
      options = labels.map((label, i) => ({ key: `o${i + 1}`, label }));
    }

    await hit(tx, LIMITS.createCall, user.id, now);
    const [call] = await tx
      .insert(calls)
      .values({
        groupId,
        authorId: user.id,
        subjectId: data.subjectId ?? null,
        text: data.text,
        kind: data.kind,
        options,
        lockAt: data.lockAt,
        eventAt: data.eventAt,
        createdAt: now,
      })
      .returning({ id: calls.id });
    return call.id;
  });
}

/** Loads a call the user can act on, locked for update. Non-members get "not found". */
async function callForUpdate(tx: Tx, user: User, callId: string) {
  if (!z.uuid().safeParse(callId).success) throw notFound("Call");
  const [call] = await tx.select().from(calls).where(eq(calls.id, callId)).for("update");
  if (!call) throw notFound("Call");
  await requireMember(tx, user, call.groupId);
  return call;
}

/** Makes or changes your pick. Allowed until picks close. */
export async function pick(db: Db, user: User, callId: string, optionKey: string, now = new Date()) {
  await db.transaction(async (tx) => {
    const call = await callForUpdate(tx, user, callId);
    const v = callVisibility(call, { userId: user.id, isMember: true }, now);
    if (!v.canPick) {
      if (call.subjectId === user.id) throw new AppError("forbidden", "This call is about you, so you can't pick.");
      if (call.status !== "active") throw new AppError("conflict", "This call is no longer open.");
      throw new AppError("conflict", "Picks are closed for this call.");
    }
    if (!call.options.some((o) => o.key === optionKey)) throw new AppError("invalid", "That isn't one of the options.");
    await tx
      .insert(picks)
      .values({ callId, userId: user.id, optionKey, updatedAt: now })
      .onConflictDoUpdate({ target: [picks.callId, picks.userId], set: { optionKey, updatedAt: now } });
  });
}

/** Takes your pick back. Allowed until picks close. */
export async function unpick(db: Db, user: User, callId: string, now = new Date()) {
  await db.transaction(async (tx) => {
    const call = await callForUpdate(tx, user, callId);
    if (!callVisibility(call, { userId: user.id, isMember: true }, now).canPick) {
      throw new AppError("conflict", "Picks are closed for this call.");
    }
    await tx.delete(picks).where(and(eq(picks.callId, callId), eq(picks.userId, user.id)));
  });
}

/**
 * Cancels a call before picks close. Only its author or the group admin can. Calls can't be edited:
 * changing the wording after people picked would be unfair, so the fix is to cancel and make a new one.
 */
export async function cancelCall(db: Db, user: User, callId: string, now = new Date()) {
  await db.transaction(async (tx) => {
    const call = await callForUpdate(tx, user, callId);
    const me = await requireMember(tx, user, call.groupId);
    if (call.authorId !== user.id && me.role !== "admin") {
      throw new AppError("forbidden", "Only the person who made this call, or the admin, can cancel it.");
    }
    if (call.status !== "active") throw new AppError("conflict", "This call is no longer open.");
    if (isLocked(call, now)) throw new AppError("conflict", "Picks have closed; this call will be settled instead.");
    await tx.update(calls).set({ status: "cancelled" }).where(eq(calls.id, callId));
  });
}

/** A call as one member sees it. Built only from what callVisibility allows. */
export type CallView = {
  id: string;
  text: string;
  kind: "yes_no" | "choice" | "member";
  options: CallOption[];
  author: string;
  subject: string | null;
  isAboutMe: boolean;
  lockAt: Date;
  eventAt: Date;
  status: "active" | "cancelled" | "settled" | "void";
  locked: boolean;
  canPick: boolean;
  canCancel: boolean;
  myPick: string | null;
  pickCount: number | null;
  eligibleCount: number;
  /** option key → number of picks; null while hidden. */
  split: Record<string, number> | null;
};

/** The group's calls for this member: open ones first (closing soonest), then closed ones (newest first). */
export async function callsForMember(db: Db, user: User, groupId: string, now = new Date()): Promise<CallView[]> {
  const me = await requireMember(db, user, groupId);
  const rows = await db
    .select()
    .from(calls)
    .where(and(eq(calls.groupId, groupId), sql`${calls.status} <> 'cancelled'`))
    .orderBy(desc(calls.lockAt))
    .limit(100);
  if (rows.length === 0) return [];

  const memberRows = await db
    .select({ userId: members.userId, displayName: members.displayName, leftAt: members.leftAt })
    .from(members)
    .where(eq(members.groupId, groupId));
  const nameOf = new Map(memberRows.map((m) => [m.userId, m.displayName]));
  const activeCount = memberRows.filter((m) => !m.leftAt).length;
  const label = (id: string | null) => (id ? (nameOf.get(id) ?? "Former member") : null);

  const ids = rows.map((r) => r.id);
  const counts = await db
    .select({ callId: picks.callId, optionKey: picks.optionKey, n: count() })
    .from(picks)
    .where(inArray(picks.callId, ids))
    .groupBy(picks.callId, picks.optionKey);
  const mine = await db
    .select({ callId: picks.callId, optionKey: picks.optionKey })
    .from(picks)
    .where(and(inArray(picks.callId, ids), eq(picks.userId, user.id)));
  const myPickOf = new Map(mine.map((p) => [p.callId, p.optionKey]));

  const views = rows.map((c): CallView => {
    const v = callVisibility(c, { userId: user.id, isMember: true }, now);
    const perOption = counts.filter((x) => x.callId === c.id);
    const total = perOption.reduce((s, x) => s + x.n, 0);
    return {
      id: c.id,
      text: c.text,
      kind: c.kind,
      options: c.options.map((o) => (c.kind === "member" ? { key: o.key, label: label(o.key)! } : o)),
      author: label(c.authorId)!,
      subject: label(c.subjectId),
      isAboutMe: c.subjectId === user.id,
      lockAt: c.lockAt,
      eventAt: c.eventAt,
      status: c.status,
      locked: isLocked(c, now),
      canPick: v.canPick,
      canCancel: c.status === "active" && !isLocked(c, now) && (c.authorId === user.id || me.role === "admin"),
      myPick: v.canSeeOwnPick ? (myPickOf.get(c.id) ?? null) : null,
      pickCount: v.canSeePickCount ? total : null,
      eligibleCount: activeCount - (c.subjectId ? 1 : 0),
      split: v.canSeeSplit ? Object.fromEntries(perOption.map((x) => [x.optionKey, x.n])) : null,
    };
  });

  const open = views.filter((c) => !c.locked).sort((a, b) => a.lockAt.getTime() - b.lockAt.getTime());
  const closed = views.filter((c) => c.locked);
  return [...open, ...closed];
}
