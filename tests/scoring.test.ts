import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { User } from "@/server/auth";
import { callsForMember } from "@/server/call-views";
import { createCall, pick } from "@/server/calls";
import { scores } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createGroup, groupForMember, joinGroup } from "@/server/groups";
import { disputeResult, proposeResult, runDueCalls, voteOnResult } from "@/server/lifecycle";
import { rank, rankingFor } from "@/server/rankings";
import { callPoints, scoresForCall } from "@/server/scoring";
import { weekRange, weekStart } from "@/server/time";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("points for a right call", () => {
  it("scores 10 to 40: the fewer who saw it coming, the more it's worth", () => {
    expect(callPoints(4, 4)).toBe(10); // everyone said it
    expect(callPoints(1, 4)).toBe(33); // 10 + 30 × 0.75 = 32.5 → 33
    expect(callPoints(1, 2)).toBe(25);
    expect(callPoints(1, 30)).toBe(39);
    expect(callPoints(0, 4)).toBe(0);
  });

  it("gives wrong picks nothing, and ignores calls with fewer than 2 pickers", () => {
    expect(scoresForCall("yes", [{ userId: "a", optionKey: "yes" }])).toEqual([]);
    expect(
      scoresForCall("yes", [
        { userId: "a", optionKey: "yes" },
        { userId: "b", optionKey: "no" },
        { userId: "c", optionKey: "no" },
      ]),
    ).toEqual([
      { userId: "a", correct: true, points: 30 },
      { userId: "b", correct: false, points: 0 },
      { userId: "c", correct: false, points: 0 },
    ]);
  });
});

describe("weeks", () => {
  it("start on Monday 00:00 in the group's time zone", () => {
    // Sunday 23:30 in Istanbul (UTC+3) is still the week that started Monday the 16th.
    const sundayNight = new Date("2026-11-22T20:30:00Z");
    expect(weekStart(sundayNight, "Europe/Istanbul").toISOString()).toBe("2026-11-15T21:00:00.000Z");
    // Half an hour later it's Monday 00:00 there: a new week.
    expect(weekStart(new Date("2026-11-22T21:00:00Z"), "Europe/Istanbul").toISOString()).toBe("2026-11-22T21:00:00.000Z");
    // In New York the same instant is still Sunday afternoon.
    expect(weekStart(sundayNight, "America/New_York").toISOString()).toBe("2026-11-16T05:00:00.000Z");
  });

  it("handle daylight saving changes", () => {
    // London clocks go back on Sun 25 Oct 2026; that week is 7 days + 1 hour long.
    const { from, to } = weekRange(new Date("2026-10-21T12:00:00Z"), "Europe/London");
    expect(from.toISOString()).toBe("2026-10-18T23:00:00.000Z"); // Mon 19 Oct 00:00 BST
    expect(to.toISOString()).toBe("2026-10-26T00:00:00.000Z"); // Mon 26 Oct 00:00 GMT
    const last = weekRange(new Date("2026-10-21T12:00:00Z"), "Europe/London", -1);
    expect(last.to.toISOString()).toBe(from.toISOString());
  });
});

describe("ranking maths", () => {
  const T = new Date("2026-01-01");
  const m = (userId: string, joined = T) => ({ userId, name: userId, joinedAt: joined });
  const call = (id: string, subjectId: string | null = null) => ({ id, lockAt: new Date("2026-02-01"), subjectId });
  const s = (callId: string, userId: string, points: number) => ({ callId, userId, points, correct: points > 0 });

  it("ranks by average points per pick, not by volume", () => {
    const counted = [call("c1"), call("c2"), call("c3")];
    const rows = rank(
      [m("busy"), m("sharp")],
      counted,
      [s("c1", "busy", 10), s("c2", "busy", 10), s("c3", "busy", 10), s("c1", "sharp", 30), s("c2", "sharp", 0)],
      1,
    );
    expect(rows.map((r) => [r.name, r.rank, r.average])).toEqual([
      ["sharp", 1, 15],
      ["busy", 2, 10],
    ]);
  });

  it("requires picking at least 60% of the calls you could have picked", () => {
    const counted = [call("c1"), call("c2"), call("c3"), call("c4"), call("c5")];
    const rows = rank([m("lucky"), m("steady")], counted, [
      s("c1", "lucky", 40),
      ...["c1", "c2", "c3"].map((c) => s(c, "steady", 10)),
    ], 1);
    const lucky = rows.find((r) => r.name === "lucky")!;
    expect(lucky.rank).toBeNull();
    expect(lucky.needed).toBe(2); // needs 3 of 5
    expect(rows[0].name).toBe("steady");
  });

  it("doesn't count calls about you or from before you joined", () => {
    const late = m("late", new Date("2026-03-01"));
    const rows = rank([m("sub"), late], [call("c1", "sub"), call("c2")], [s("c2", "sub", 10)], 1);
    expect(rows.find((r) => r.name === "sub")!.eligible).toBe(1);
    expect(rows.find((r) => r.name === "late")!.eligible).toBe(0);
  });

  it("shares a rank on equal average and number right", () => {
    const rows = rank([m("a"), m("b"), m("c")], [call("c1")], [s("c1", "a", 25), s("c1", "b", 25), s("c1", "c", 0)], 1);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});

describe("end to end", () => {
  const T0 = new Date("2026-11-16T09:00:00Z"); // a Monday
  const H = 3600_000;
  const at = (h: number) => new Date(T0.getTime() + h * H);
  let n = 0;

  async function group() {
    const u: Record<string, User> = {};
    for (const name of ["Ada", "Bo", "Cem", "Dee", "Eve"]) u[name] = (await signUp(db, name)).user;
    const groupId = await createGroup(db, u.Ada, { name: "Weekly", timeZone: "UTC", displayName: "Ada" }, T0);
    const invite = (await groupForMember(db, u.Ada, groupId)).inviteToken!;
    for (const name of ["Bo", "Cem", "Dee", "Eve"]) await joinGroup(db, u[name], invite, name, `5.5.5.${++n}`, T0);
    return { u, groupId };
  }

  it("writes scores when a call settles and shows them on the card", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Ada, groupId, { text: "Will Bo finish the book?", kind: "yes_no", lockAt: at(2), eventAt: at(4) }, T0);
    await pick(db, u.Ada, id, "yes", at(1));
    await pick(db, u.Bo, id, "no", at(1));
    await pick(db, u.Cem, id, "no", at(1));
    await pick(db, u.Dee, id, "no", at(1));
    await runDueCalls(db, at(2)); // Eve is the neutral settler
    await proposeResult(db, u.Eve, id, "yes", at(4));
    await runDueCalls(db, at(28));

    const rows = await db.select().from(scores).where(eq(scores.callId, id));
    expect(rows.find((r) => r.userId === u.Ada.id)).toMatchObject({ points: 33, correct: true });
    expect(rows.find((r) => r.userId === u.Bo.id)).toMatchObject({ points: 0, correct: false });

    const card = (await callsForMember(db, u.Ada, groupId, at(28))).find((c) => c.id === id)!;
    expect(card).toMatchObject({ myPoints: 33, rightCount: 1, counted: true });
  });

  it("scores the vote's answer, not the settler's, when a dispute overturns it", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Ada, groupId, { text: "Will it snow?", kind: "yes_no", lockAt: at(2), eventAt: at(4) }, T0);
    await pick(db, u.Bo, id, "yes", at(1));
    await pick(db, u.Cem, id, "no", at(1));
    await pick(db, u.Dee, id, "no", at(1));
    await runDueCalls(db, at(2));
    const settler = Object.values(u).find((x) => x.id !== u.Bo.id && x.id !== u.Cem.id && x.id !== u.Dee.id && x.id !== u.Ada.id)!;
    await proposeResult(db, settler, id, "yes", at(4));
    await disputeResult(db, u.Cem, id, "no", at(5));
    await voteOnResult(db, u.Dee, id, "no", at(6));
    await voteOnResult(db, u.Bo, id, "yes", at(6)); // all voted: 2-1 for "no"
    const rows = await db.select().from(scores).where(eq(scores.callId, id));
    expect(rows.filter((r) => r.correct).map((r) => r.userId).sort()).toEqual([u.Cem.id, u.Dee.id].sort());
  });

  it("gives nobody points for a called-off call", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Ada, groupId, { text: "Will the bus be on time?", kind: "yes_no", lockAt: at(2), eventAt: at(4) }, T0);
    await pick(db, u.Bo, id, "yes", at(1));
    await pick(db, u.Cem, id, "no", at(1));
    await runDueCalls(db, at(2));
    const [settler] = Object.values(u).filter((x) => ![u.Ada.id, u.Bo.id, u.Cem.id].includes(x.id));
    const s = (await callsForMember(db, u.Ada, groupId, at(4))).find((c) => c.id === id)!;
    const actual = Object.values(u).find((x) => x.name === s.settler) ?? settler;
    await proposeResult(db, actual, id, "void", at(4));
    await runDueCalls(db, at(28));
    expect(await db.select().from(scores).where(eq(scores.callId, id))).toEqual([]);
  });

  it("builds this week's and last week's tables", async () => {
    const { u, groupId } = await group();
    // Settles on Wednesday of week 1.
    const id = await createCall(db, u.Ada, groupId, { text: "Will the plant survive?", kind: "yes_no", lockAt: at(2), eventAt: at(4) }, T0);
    await pick(db, u.Ada, id, "yes", at(1));
    await pick(db, u.Bo, id, "no", at(1));
    await runDueCalls(db, at(2));
    const settlerName = (await callsForMember(db, u.Ada, groupId, at(3))).find((c) => c.id === id)!.settler!;
    await proposeResult(db, Object.values(u).find((x) => x.name === settlerName)!, id, "yes", at(4));
    await runDueCalls(db, at(48));

    const week1 = await rankingFor(db, u.Bo, groupId, "this-week", at(50));
    expect(week1.calls).toBe(1);
    expect(week1.rows[0]).toMatchObject({ name: "Ada", rank: 1, points: 25, average: 25 });
    expect(week1.rows.find((r) => r.name === "Bo")).toMatchObject({ rank: 2, points: 0 });
    // Cem could have picked but didn't: not ranked, needs 1 pick.
    expect(week1.rows.find((r) => r.name === "Cem")).toMatchObject({ rank: null, needed: 1 });

    const nextMonday = at(7 * 24 + 1);
    expect((await rankingFor(db, u.Bo, groupId, "this-week", nextMonday)).calls).toBe(0);
    expect((await rankingFor(db, u.Bo, groupId, "last-week", nextMonday)).rows[0].name).toBe("Ada");
  });

  it("is only visible to members", async () => {
    const { groupId } = await group();
    const outsider = (await signUp(db, "Nosy")).user;
    await expect(rankingFor(db, outsider, groupId, "all-time")).rejects.toMatchObject({ code: "not_found" });
  });
});
