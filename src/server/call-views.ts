import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { User } from "./auth";
import { calls, members, picks, reports, scores, type CallOption, type CallStatus } from "./db/schema";
import { blockedIds } from "./moderation";
import { MIN_PICKERS } from "./scoring";
import type { Db } from "./db/types";
import { requireMember } from "./groups";
import { disputeEndsAt, SETTLER_GRACE_MS, voteState, VOID } from "./lifecycle";
import { callVisibility, isLocked } from "./visibility";

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
  status: CallStatus;
  locked: boolean;
  canPick: boolean;
  canCancel: boolean;
  myPick: string | null;
  pickCount: number | null;
  eligibleCount: number;
  /** option key → number of picks; null while hidden. */
  split: Record<string, number> | null;

  // Settling
  settler: string | null;
  isSettler: boolean;
  /** True once the event time has passed and nobody has entered a result yet. */
  awaitingResult: boolean;
  canSettle: boolean;
  /** When anyone (not just the settler) may enter the result. */
  openToAllAt: Date;
  proposedResult: string | null;
  proposedBy: string | null;
  disputeEndsAt: Date | null;
  canDispute: boolean;
  disputedBy: string | null;
  voteClosesAt: Date | null;
  votesCast: number | null;
  eligibleVoters: number | null;
  myVote: string | null;
  canVote: boolean;
  /** option key → vote count, only once the call is final. */
  voteTally: Record<string, number> | null;
  /** The final answer (option key) for settled calls. */
  result: string | null;
  voidReason: string | null;
  /** option key → names, only once settled. */
  whoPicked: Record<string, string[]> | null;
  /** When the result became final (settled or called off). */
  settledAt: Date | null;
  /** Your points on a settled call that counted (0 if wrong); null otherwise. */
  myPoints: number | null;
  /** Settled calls: how many got it right, and whether the call counted for points. */
  rightCount: number | null;
  counted: boolean | null;
  /** The person it's about can hide it with one tap; others can report it. Not the author. */
  canHide: boolean;
  canReport: boolean;
  /** Group admin, when the call isn't theirs: can remove its author from the group. */
  authorId: string | null;
  /** Can make a public link to the result (see visibility.canShare). */
  canShare: boolean;
};

/** The group's calls for this member: open ones first (closing soonest), then the rest (newest first). */
export async function callsForMember(db: Db, user: User, groupId: string, now = new Date()): Promise<CallView[]> {
  const me = await requireMember(db, user, groupId);
  const rows = await db
    .select()
    .from(calls)
    .where(and(eq(calls.groupId, groupId), sql`${calls.status} <> 'cancelled'`, eq(calls.moderation, "visible")))
    .orderBy(desc(calls.lockAt))
    .limit(100);
  const blocked = await blockedIds(db, user.id);
  const reportedRows = await db.select({ callId: reports.callId }).from(reports).where(eq(reports.userId, user.id));
  const reportedByMe = new Set(reportedRows.map((r) => r.callId));
  // Calls by people you've blocked don't show up for you, except one you're settling (so it still gets a result).
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.authorId && blocked.has(r.authorId) && r.settlerId !== user.id) rows.splice(i, 1);
  }
  if (rows.length === 0) return [];

  const memberRows = await db
    .select({ userId: members.userId, displayName: members.displayName, leftAt: members.leftAt })
    .from(members)
    .where(eq(members.groupId, groupId));
  const nameOf = new Map(memberRows.map((m) => [m.userId, m.displayName]));
  const active = new Set(memberRows.filter((m) => !m.leftAt).map((m) => m.userId));
  const label = (id: string | null) => (id ? (nameOf.get(id) ?? "Former member") : null);

  const ids = rows.map((r) => r.id);
  const counts = await db
    .select({ callId: picks.callId, optionKey: picks.optionKey, n: count() })
    .from(picks)
    .where(inArray(picks.callId, ids))
    .groupBy(picks.callId, picks.optionKey);
  // Who picked is needed for permissions (did I pick?) and, once settled, for showing names.
  const allPicks = await db
    .select({ callId: picks.callId, userId: picks.userId, optionKey: picks.optionKey })
    .from(picks)
    .where(inArray(picks.callId, ids));
  const settledIds = rows.filter((r) => r.status === "settled").map((r) => r.id);
  const myScores = settledIds.length
    ? await db
        .select({ callId: scores.callId, points: scores.points })
        .from(scores)
        .where(and(inArray(scores.callId, settledIds), eq(scores.userId, user.id)))
    : [];
  const myPointsOf = new Map(myScores.map((s) => [s.callId, s.points]));
  const votesByCall = await voteState(db, ids.filter((_, i) => rows[i].disputedBy), user.id);

  const views = rows.map((c): CallView => {
    const v = callVisibility(c, { userId: user.id, isMember: true }, now);
    if (!v.canSeeCall) throw new Error("visibility mismatch"); // rows are already filtered to visible calls
    const perOption = counts.filter((x) => x.callId === c.id);
    const total = perOption.reduce((s, x) => s + x.n, 0);
    const pickers = allPicks.filter((p) => p.callId === c.id);
    const myPick = pickers.find((p) => p.userId === user.id)?.optionKey ?? null;
    const isSubject = c.subjectId === user.id;

    const openToAllAt = new Date(c.eventAt.getTime() + SETTLER_GRACE_MS);
    const settlerGone = !c.settlerId || !active.has(c.settlerId);
    const awaitingResult = c.status === "active" && now >= c.eventAt;
    const canSettle =
      awaitingResult && !isSubject && (user.id === c.settlerId || settlerGone || now >= openToAllAt);

    const disputeEnd = disputeEndsAt(c);
    const voters = pickers.filter((p) => active.has(p.userId) && p.userId !== c.proposedBy && p.userId !== c.subjectId);
    const amVoter = voters.some((p) => p.userId === user.id);
    const vs = votesByCall.get(c.id);
    const canDispute = c.status === "proposed" && !!disputeEnd && now < disputeEnd && amVoter;
    const canVote = c.status === "disputed" && !!c.voteClosesAt && now < c.voteClosesAt && amVoter && !vs?.mine;

    let whoPicked: Record<string, string[]> | null = null;
    if (v.canSeeWhoPicked) {
      whoPicked = {};
      for (const p of pickers) (whoPicked[p.optionKey] ??= []).push(label(p.userId)!);
    }

    return {
      id: c.id,
      text: c.text,
      kind: c.kind,
      options: c.options.map((o) => (c.kind === "member" ? { key: o.key, label: label(o.key)! } : o)),
      author: label(c.authorId) ?? "Former member",
      subject: label(c.subjectId),
      isAboutMe: isSubject,
      lockAt: c.lockAt,
      eventAt: c.eventAt,
      status: c.status,
      locked: isLocked(c, now),
      canPick: v.canPick,
      canCancel: c.status === "active" && !isLocked(c, now) && (c.authorId === user.id || me.role === "admin"),
      myPick: v.canSeeOwnPick ? myPick : null,
      pickCount: v.canSeePickCount ? total : null,
      eligibleCount: active.size - (c.subjectId && active.has(c.subjectId) ? 1 : 0),
      split: v.canSeeSplit ? Object.fromEntries(perOption.map((x) => [x.optionKey, x.n])) : null,

      settler: label(c.settlerId),
      isSettler: c.settlerId === user.id,
      awaitingResult,
      canSettle,
      openToAllAt,
      proposedResult: c.proposedResult,
      proposedBy: label(c.proposedBy),
      disputeEndsAt: disputeEnd,
      canDispute,
      disputedBy: label(c.disputedBy),
      voteClosesAt: c.voteClosesAt,
      votesCast: c.disputedBy ? (vs?.cast ?? 0) : null,
      eligibleVoters: c.disputedBy ? voters.length : null,
      myVote: vs?.mine ?? null,
      canVote,
      voteTally: v.canSeeVoteTally && c.disputedBy ? (vs?.counts ?? {}) : null,
      result: c.status === "settled" ? c.result : null,
      voidReason: c.status === "void" ? c.voidReason : null,
      whoPicked,
      settledAt: c.status === "settled" || c.status === "void" ? c.settledAt : null,
      myPoints: c.status === "settled" ? (myPointsOf.get(c.id) ?? null) : null,
      rightCount: c.status === "settled" ? pickers.filter((p) => p.optionKey === c.result).length : null,
      counted: c.status === "settled" ? pickers.length >= MIN_PICKERS : null,
      canHide: isSubject,
      canReport: !isSubject && c.authorId !== user.id && !reportedByMe.has(c.id),
      authorId: c.authorId,
      canShare: v.canShare,
    };
  });

  const open = views.filter((c) => !c.locked).sort((a, b) => a.lockAt.getTime() - b.lockAt.getTime());
  const rest = views.filter((c) => c.locked);
  return [...open, ...rest];
}

export { VOID };
