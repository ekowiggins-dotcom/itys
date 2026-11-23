/**
 * Rankings reward being right, not picking a lot:
 * - You're ranked by average points per call you picked on (only calls that counted, see scoring.ts).
 * - To be ranked you must have picked at least MIN_SHARE of the calls you could have picked on in the period
 *   (you were in the group when picks closed and the call wasn't about you), so one lucky pick can't top the table.
 * - Ties on average and number right share a rank.
 */
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import type { User } from "./auth";
import { calls, groups, members, scores } from "./db/schema";
import type { Db } from "./db/types";
import { requireMember } from "./groups";
import { weekRange } from "./time";

export const MIN_SHARE = 0.6;
/** All-time tables also need a few calls before you're ranked. */
export const MIN_PICKS_ALL_TIME = 5;

export type Period = "this-week" | "last-week" | "all-time";

export type RankingRow = {
  userId: string;
  name: string;
  rank: number | null;
  points: number;
  picked: number;
  correct: number;
  eligible: number;
  /** Average points per call picked, one decimal. */
  average: number;
  /** Picks still needed to be ranked in this period (0 when ranked). */
  needed: number;
};

export type Ranking = { period: Period; from: Date | null; to: Date | null; calls: number; rows: RankingRow[] };

type MemberInfo = { userId: string; name: string; joinedAt: Date };
type CountedCall = { id: string; lockAt: Date; subjectId: string | null };
type Score = { callId: string; userId: string; points: number; correct: boolean };

/** Pure ranking maths, kept separate from the queries so it's easy to test. */
export function rank(membersIn: MemberInfo[], counted: CountedCall[], scoreRows: Score[], minPicks: number): RankingRow[] {
  const rows = membersIn.map((m): RankingRow => {
    const eligible = counted.filter((c) => c.subjectId !== m.userId && m.joinedAt <= c.lockAt).length;
    const mine = scoreRows.filter((s) => s.userId === m.userId);
    const points = mine.reduce((a, s) => a + s.points, 0);
    const correct = mine.filter((s) => s.correct).length;
    const required = Math.max(minPicks, Math.ceil(MIN_SHARE * eligible));
    const average = mine.length ? Math.round((points / mine.length) * 10) / 10 : 0;
    return {
      userId: m.userId,
      name: m.name,
      rank: null,
      points,
      picked: mine.length,
      correct,
      eligible,
      average,
      needed: Math.max(0, required - mine.length),
    };
  });

  const ranked = rows
    .filter((r) => r.needed === 0 && r.picked > 0)
    .sort((a, b) => b.average - a.average || b.correct - a.correct || a.name.localeCompare(b.name));
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    r.rank = prev && prev.average === r.average && prev.correct === r.correct ? prev.rank : i + 1;
  });
  const unranked = rows
    .filter((r) => r.rank === null)
    .sort((a, b) => a.needed - b.needed || b.points - a.points || a.name.localeCompare(b.name));
  return [...ranked, ...unranked];
}

export async function rankingFor(db: Db, user: User, groupId: string, period: Period, now = new Date()): Promise<Ranking> {
  await requireMember(db, user, groupId);
  const [group] = await db.select({ timeZone: groups.timeZone }).from(groups).where(eq(groups.id, groupId));
  const range = period === "all-time" ? null : weekRange(now, group.timeZone, period === "this-week" ? 0 : -1);

  const where = range
    ? and(eq(scores.groupId, groupId), gte(scores.settledAt, range.from), lt(scores.settledAt, range.to))
    : eq(scores.groupId, groupId);
  const scoreRows = await db
    .select({ callId: scores.callId, userId: scores.userId, points: scores.points, correct: scores.correct })
    .from(scores)
    .where(where);

  const callIds = [...new Set(scoreRows.map((s) => s.callId))];
  const counted = callIds.length
    ? await db
        .select({ id: calls.id, lockAt: calls.lockAt, subjectId: calls.subjectId })
        .from(calls)
        .where(inArray(calls.id, callIds))
    : [];

  const memberRows = await db
    .select({ userId: members.userId, name: members.displayName, joinedAt: members.joinedAt })
    .from(members)
    .where(and(eq(members.groupId, groupId), isNull(members.leftAt)));

  return {
    period,
    from: range?.from ?? null,
    to: range?.to ?? null,
    calls: counted.length,
    rows: rank(memberRows, counted, scoreRows, period === "all-time" ? MIN_PICKS_ALL_TIME : 1),
  };
}
