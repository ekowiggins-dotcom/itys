/**
 * How a call ends. After picks close:
 *
 * 1. A settler is chosen: preferably someone neutral (didn't pick, didn't write it, not the subject).
 * 2. From the event time, the settler proposes the result (an option, or "void" if it didn't happen / is unclear).
 *    If they haven't within 48 hours, any member except the subject may. After 7 days unsettled, it's void.
 * 3. For 24 hours anyone who picked (except the proposer) can dispute, naming the answer they think is right.
 * 4. A dispute opens a 24-hour vote among people who picked (not the proposer, not the subject). The disputer's
 *    vote counts. The answer with more than half of the votes cast wins. A tie, no majority, or fewer than
 *    2 votes makes the call void: nobody scores, and nobody wins just by settling first.
 *
 * Everything time-based is driven by `advance`, which both the job runner and every user action call first,
 * so the rules hold even if the job runner is late.
 */
import { and, asc, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import type { User } from "./auth";
import { callForUpdate } from "./calls";
import { hashToken } from "./crypto";
import { calls, members, picks, scores, votes } from "./db/schema";
import type { Db, Tx } from "./db/types";
import { AppError } from "./errors";
import { scoresForCall } from "./scoring";
import { emit, groupMemberIds } from "./notify";
import { REMINDER_BEFORE_LOCK_MS } from "./timing";

export const H = 3600_000;
export const SETTLER_GRACE_MS = 48 * H;
export const SETTLE_DEADLINE_MS = 7 * 24 * H;
export const DISPUTE_WINDOW_MS = 24 * H;
export const VOTE_WINDOW_MS = 24 * H;
export const MIN_VOTES = 2;
export const VOID = "void";
export { REMINDER_BEFORE_LOCK_MS };

type Call = typeof calls.$inferSelect;

/** When the job runner next needs to look at a call, or null when nothing more can happen on its own. */
export function nextActionAt(
  c: Pick<Call, "status" | "settlerId" | "lockAt" | "eventAt" | "proposedAt" | "voteClosesAt" | "remindedAt" | "settlePromptedAt">,
) {
  switch (c.status) {
    case "active":
      if (!c.settlerId) return c.remindedAt ? c.lockAt : new Date(c.lockAt.getTime() - REMINDER_BEFORE_LOCK_MS);
      return c.settlePromptedAt ? new Date(c.eventAt.getTime() + SETTLE_DEADLINE_MS) : c.eventAt;
    case "proposed":
      return new Date(c.proposedAt!.getTime() + DISPUTE_WINDOW_MS);
    case "disputed":
      return c.voteClosesAt;
    default:
      return null;
  }
}

export const disputeEndsAt = (c: Pick<Call, "proposedAt">) =>
  c.proposedAt ? new Date(c.proposedAt.getTime() + DISPUTE_WINDOW_MS) : null;

async function activeMemberIds(tx: Tx, groupId: string) {
  const rows = await tx
    .select({ userId: members.userId })
    .from(members)
    .where(and(eq(members.groupId, groupId), isNull(members.leftAt)));
  return new Set(rows.map((r) => r.userId));
}

/**
 * Picks the settler. Neutral members first (didn't pick, didn't write the call), then pickers, then the author.
 * The subject never settles. Within a tier the order is a stable shuffle, so tests are repeatable.
 */
export function chooseSettler(c: Pick<Call, "id" | "authorId" | "subjectId">, active: Set<string>, pickers: Set<string>) {
  const shuffle = (ids: string[]) => ids.sort((a, b) => hashToken(c.id + a).localeCompare(hashToken(c.id + b)));
  const eligible = [...active].filter((id) => id !== c.subjectId);
  const neutral = shuffle(eligible.filter((id) => !pickers.has(id) && id !== c.authorId));
  const pickedOthers = shuffle(eligible.filter((id) => pickers.has(id) && id !== c.authorId));
  return neutral[0] ?? pickedOthers[0] ?? (eligible.includes(c.authorId) ? c.authorId : null);
}

async function save(tx: Tx, c: Call, patch: Partial<Call>) {
  const next = { ...c, ...patch };
  next.nextActionAt = nextActionAt(next);
  await tx
    .update(calls)
    .set({ ...patch, nextActionAt: next.nextActionAt })
    .where(eq(calls.id, c.id));
  return next;
}

async function pickerIds(tx: Tx, callId: string) {
  return (await tx.select({ userId: picks.userId }).from(picks).where(eq(picks.callId, callId))).map((p) => p.userId);
}

async function callOff(tx: Tx, c: Call, reason: string, now: Date) {
  const saved = await save(tx, c, { status: "void", result: null, voidReason: reason, settledAt: now });
  await emit(tx, { type: "called_off", groupId: c.groupId, callId: c.id, userIds: [...(await pickerIds(tx, c.id)), c.authorId], now });
  return saved;
}

async function finalize(tx: Tx, c: Call, result: string, reason: string, now: Date) {
  if (result === VOID) return callOff(tx, c, reason, now);
  const pickRows = await tx
    .select({ userId: picks.userId, optionKey: picks.optionKey })
    .from(picks)
    .where(eq(picks.callId, c.id));
  const rows = scoresForCall(result, pickRows);
  if (rows.length) {
    await tx
      .insert(scores)
      .values(rows.map((r) => ({ ...r, callId: c.id, groupId: c.groupId, settledAt: now })))
      .onConflictDoNothing();
  }
  const saved = await save(tx, c, { status: "settled", result, voidReason: null, settledAt: now });
  await emit(tx, { type: "settled", groupId: c.groupId, callId: c.id, userIds: [...pickRows.map((p) => p.userId), c.authorId], now });
  return saved;
}

/** Voters in a dispute: people who picked and are still members, except the proposer and the subject. */
async function eligibleVoters(tx: Tx, c: Call) {
  const active = await activeMemberIds(tx, c.groupId);
  const rows = await tx.select({ userId: picks.userId }).from(picks).where(eq(picks.callId, c.id));
  return new Set(rows.map((r) => r.userId).filter((id) => active.has(id) && id !== c.proposedBy && id !== c.subjectId));
}

export async function tallyVote(tx: Tx, c: Call) {
  const rows = await tx.select({ optionKey: votes.optionKey }).from(votes).where(eq(votes.callId, c.id));
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.optionKey, (counts.get(r.optionKey) ?? 0) + 1);
  return { cast: rows.length, counts };
}

/** The vote's outcome: an answer with more than half the votes cast, else void. */
export function voteOutcome(cast: number, counts: Map<string, number>) {
  if (cast < MIN_VOTES) return VOID;
  for (const [answer, n] of counts) if (n * 2 > cast) return answer;
  return VOID;
}

async function closeVote(tx: Tx, c: Call, now: Date) {
  const { cast, counts } = await tallyVote(tx, c);
  return finalize(tx, c, voteOutcome(cast, counts), "vote", now);
}

/** Applies every time-based step that is due. Safe to call any number of times. */
export async function advance(tx: Tx, c: Call, now: Date): Promise<Call> {
  const t = now.getTime();
  for (;;) {
    if (c.status === "active" && !c.settlerId && !c.remindedAt) {
      // Remind people who haven't picked, unless it's already too late to be useful.
      if (t < c.lockAt.getTime() - REMINDER_BEFORE_LOCK_MS) return c;
      if (t < c.lockAt.getTime()) {
        const picked = await pickerIds(tx, c.id);
        const waiting = (await groupMemberIds(tx, c.groupId, [c.subjectId])).filter((id) => !picked.includes(id));
        await emit(tx, { type: "lock_reminder", groupId: c.groupId, callId: c.id, userIds: waiting, now });
      }
      c = await save(tx, c, { remindedAt: now });
    } else if (c.status === "active" && c.settlerId && !c.settlePromptedAt && t >= c.eventAt.getTime()) {
      await emit(tx, { type: "settle_prompt", groupId: c.groupId, callId: c.id, userIds: [c.settlerId], now });
      c = await save(tx, c, { settlePromptedAt: now });
    } else if (c.status === "active" && !c.settlerId && t >= c.lockAt.getTime()) {
      const active = await activeMemberIds(tx, c.groupId);
      const pickRows = await tx.select({ userId: picks.userId }).from(picks).where(eq(picks.callId, c.id));
      const settlerId = chooseSettler(c, active, new Set(pickRows.map((p) => p.userId)));
      if (!settlerId) return callOff(tx, c, "no one to settle", now);
      c = await save(tx, c, { settlerId });
    } else if (c.status === "active" && c.settlerId && t >= c.eventAt.getTime() + SETTLE_DEADLINE_MS) {
      return callOff(tx, c, "not settled in time", now);
    } else if (c.status === "proposed" && t >= c.proposedAt!.getTime() + DISPUTE_WINDOW_MS) {
      return finalize(tx, c, c.proposedResult!, "settler", now);
    } else if (c.status === "disputed" && t >= c.voteClosesAt!.getTime()) {
      return closeVote(tx, c, now);
    } else {
      return c;
    }
  }
}

function checkAnswer(c: Call, answer: string) {
  if (answer !== VOID && !c.options.some((o) => o.key === answer)) {
    throw new AppError("invalid", "That isn't one of the answers.");
  }
}

/** Proposes the result. The settler from the event time; anyone (but the subject) once they've had 48 hours. */
export async function proposeResult(db: Db, user: User, callId: string, answer: string, now = new Date()) {
  await db.transaction(async (tx) => {
    let c = await callForUpdate(tx, user, callId);
    c = await advance(tx, c, now);
    if (c.status !== "active") throw new AppError("conflict", "This call already has a result.");
    if (now < c.eventAt) throw new AppError("conflict", "The result can be entered once the event has happened.");
    if (user.id === c.subjectId) throw new AppError("forbidden", "This call is about you, so someone else settles it.");
    const active = await activeMemberIds(tx, c.groupId);
    const settlerGone = !c.settlerId || !active.has(c.settlerId);
    const graceOver = now.getTime() >= c.eventAt.getTime() + SETTLER_GRACE_MS;
    if (user.id !== c.settlerId && !settlerGone && !graceOver) {
      throw new AppError("forbidden", "The settler enters the result first. Anyone can after 48 hours.");
    }
    checkAnswer(c, answer);
    await save(tx, c, { status: "proposed", proposedResult: answer, proposedBy: user.id, proposedAt: now });
    await emit(tx, { type: "result_proposed", groupId: c.groupId, callId, actorId: user.id, userIds: await pickerIds(tx, callId), now });
  });
}

/** Disputes a proposed result within 24 hours. Opens a group vote with the disputer's answer as their vote. */
export async function disputeResult(db: Db, user: User, callId: string, answer: string, now = new Date()) {
  await db.transaction(async (tx) => {
    let c = await callForUpdate(tx, user, callId);
    c = await advance(tx, c, now);
    if (c.status === "disputed") throw new AppError("conflict", "This result is already being voted on.");
    if (c.status !== "proposed") throw new AppError("conflict", "The time to dispute this result has passed.");
    if (user.id === c.proposedBy) throw new AppError("forbidden", "You entered this result.");
    if (!(await eligibleVoters(tx, c)).has(user.id)) {
      throw new AppError("forbidden", "Only people who picked on this call can dispute it.");
    }
    checkAnswer(c, answer);
    if (answer === c.proposedResult) throw new AppError("invalid", "That's the result already entered.");
    await save(tx, c, { status: "disputed", disputedBy: user.id, voteClosesAt: new Date(now.getTime() + VOTE_WINDOW_MS) });
    await tx.insert(votes).values({ callId, userId: user.id, optionKey: answer, createdAt: now });
    const voters = await eligibleVoters(tx, { ...c, proposedBy: c.proposedBy });
    await emit(tx, { type: "vote_needed", groupId: c.groupId, callId, actorId: user.id, userIds: [...voters], now });
  });
}

/** Votes in a dispute. Votes can't be changed. The vote closes early once everyone eligible has voted. */
export async function voteOnResult(db: Db, user: User, callId: string, answer: string, now = new Date()) {
  await db.transaction(async (tx) => {
    let c = await callForUpdate(tx, user, callId);
    c = await advance(tx, c, now);
    if (c.status !== "disputed") throw new AppError("conflict", "There's no vote open on this call.");
    const voters = await eligibleVoters(tx, c);
    if (!voters.has(user.id)) throw new AppError("forbidden", "Only people who picked on this call, other than whoever entered the result, can vote.");
    checkAnswer(c, answer);
    const inserted = await tx
      .insert(votes)
      .values({ callId, userId: user.id, optionKey: answer, createdAt: now })
      .onConflictDoNothing()
      .returning({ userId: votes.userId });
    if (inserted.length === 0) throw new AppError("conflict", "You've already voted.");
    const { cast } = await tallyVote(tx, c);
    if (cast >= voters.size) await closeVote(tx, c, now);
  });
}

/**
 * The job runner: applies due steps to calls whose next_action_at has passed. Each call is handled in its own
 * transaction; SKIP LOCKED lets several workers run side by side without doing the same call twice.
 */
export async function runDueCalls(db: Db, now = new Date(), limit = 200) {
  const due = await db
    .select({ id: calls.id })
    .from(calls)
    .where(and(isNotNull(calls.nextActionAt), lte(calls.nextActionAt, now)))
    .orderBy(asc(calls.nextActionAt))
    .limit(limit);
  let advanced = 0;
  for (const { id } of due) {
    await db.transaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(calls)
        .where(and(eq(calls.id, id), isNotNull(calls.nextActionAt), lte(calls.nextActionAt, now)))
        .for("update", { skipLocked: true });
      if (!c) return; // another worker has it, or it's no longer due
      await advance(tx, c, now);
      advanced++;
    });
  }
  return { due: due.length, advanced };
}

/** What the vote looks like for one viewer. Only counts, never who voted what. */
export async function voteState(db: Db | Tx, callIds: string[], userId: string) {
  if (callIds.length === 0) return new Map<string, { cast: number; mine: string | null; counts: Record<string, number> }>();
  const rows = await db
    .select({ callId: votes.callId, userId: votes.userId, optionKey: votes.optionKey })
    .from(votes)
    .where(inArray(votes.callId, callIds));
  const out = new Map<string, { cast: number; mine: string | null; counts: Record<string, number> }>();
  for (const r of rows) {
    const s = out.get(r.callId) ?? { cast: 0, mine: null, counts: {} };
    s.cast++;
    s.counts[r.optionKey] = (s.counts[r.optionKey] ?? 0) + 1;
    if (r.userId === userId) s.mine = r.optionKey;
    out.set(r.callId, s);
  }
  return out;
}

