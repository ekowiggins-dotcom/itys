import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { User } from "@/server/auth";
import { callsForMember } from "@/server/call-views";
import { createCall, pick, type NewCall } from "@/server/calls";
import { calls } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createGroup, groupForMember, joinGroup, leaveGroup } from "@/server/groups";
import {
  chooseSettler,
  disputeResult,
  proposeResult,
  runDueCalls,
  voteOnResult,
  voteOutcome,
} from "@/server/lifecycle";
import { givePro, signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const T0 = new Date("2026-07-01T12:00:00Z");
const H = 3600_000;
const at = (hours: number) => new Date(T0.getTime() + hours * H);
// Picks close at +24h, the event is at +48h.
const LOCK = 24;
const EVENT = 48;

let ipN = 0;
async function group(names: string[]) {
  const users: Record<string, User> = {};
  for (const n of names) users[n] = (await signUp(db, n)).user;
  const [first, ...rest] = names;
  const groupId = await createGroup(db, users[first], { name: "Group", timeZone: "UTC", displayName: first }, T0);
  await givePro(db, users[first].id); // 5+ members need Who’ll Pro
  const invite = (await groupForMember(db, users[first], groupId)).inviteToken!;
  for (const n of rest) await joinGroup(db, users[n], invite, n, `6.6.${Math.floor(++ipN / 250)}.${ipN % 250}`, T0);
  return { users, groupId };
}

const call = (extra: Partial<NewCall> = {}): NewCall => ({
  text: "Will the party start on time?",
  kind: "yes_no",
  lockAt: at(LOCK),
  eventAt: at(EVENT),
  ...extra,
});

const row = async (id: string) => (await db.select().from(calls).where(eq(calls.id, id)))[0];
const view = async (u: User, groupId: string, id: string, now: Date) =>
  (await callsForMember(db, u, groupId, now)).find((c) => c.id === id)!;

/** Runs the job runner and returns the call's row. */
async function tick(id: string, now: Date) {
  await runDueCalls(db, now);
  return row(id);
}

describe("choosing the settler", () => {
  const c = { id: "call-1", authorId: "author", subjectId: "subject" };
  it("prefers someone neutral: didn't pick, didn't write it, not the subject", () => {
    const active = new Set(["author", "subject", "p1", "p2", "neutral"]);
    expect(chooseSettler(c, active, new Set(["p1", "p2", "author"]))).toBe("neutral");
  });
  it("falls back to a picker other than the author, then the author", () => {
    expect(chooseSettler(c, new Set(["author", "subject", "p1"]), new Set(["p1"]))).toBe("p1");
    expect(chooseSettler(c, new Set(["author", "subject"]), new Set())).toBe("author");
  });
  it("never picks the subject", () => {
    expect(chooseSettler({ ...c, authorId: "subject" }, new Set(["subject"]), new Set())).toBeNull();
  });
});

describe("the vote rule", () => {
  const m = (o: Record<string, number>) => new Map(Object.entries(o));
  it("needs more than half of the votes cast", () => {
    expect(voteOutcome(3, m({ yes: 2, no: 1 }))).toBe("yes");
    expect(voteOutcome(4, m({ yes: 2, no: 2 }))).toBe("void");
    expect(voteOutcome(5, m({ o1: 2, o2: 2, o3: 1 }))).toBe("void");
  });
  it("voids with fewer than two votes", () => {
    expect(voteOutcome(1, m({ yes: 1 }))).toBe("void");
    expect(voteOutcome(0, m({}))).toBe("void");
  });
});

describe("settling", () => {
  it("assigns a settler when picks close, and only they can settle at first", async () => {
    const { users, groupId } = await group(["Ada", "Bo", "Cem", "Dee"]);
    const { Ada, Bo, Cem, Dee } = users;
    const id = await createCall(db, Ada, groupId, call(), T0);
    await pick(db, Bo, id, "yes", at(1));
    await pick(db, Cem, id, "no", at(1));

    const r = await tick(id, at(LOCK));
    expect(r.settlerId).toBe(Dee.id); // the only neutral member
    expect(r.nextActionAt).toEqual(at(EVENT)); // next: tell the settler it is time

    await expect(proposeResult(db, Dee, id, "yes", at(EVENT - 1))).rejects.toThrow(/once the event has happened/);
    await expect(proposeResult(db, Bo, id, "yes", at(EVENT + 1))).rejects.toThrow(/settler enters the result first/);
    await proposeResult(db, Dee, id, "yes", at(EVENT + 1));
    const v = await view(Ada, groupId, id, at(EVENT + 1));
    expect(v.status).toBe("proposed");
    expect(v.proposedBy).toBe("Dee");
  });

  it("lets anyone but the subject settle after 48 hours", async () => {
    const { users, groupId } = await group(["Ada", "Bo", "Cem"]);
    const { Ada, Bo, Cem } = users;
    const id = await createCall(db, Ada, groupId, call({ subjectId: Cem.id }), T0);
    await pick(db, Bo, id, "yes", at(1));
    const r = await tick(id, at(LOCK));
    expect(r.settlerId).toBe(Bo.id); // nobody neutral: a picker other than the author settles
    await expect(proposeResult(db, Ada, id, "yes", at(EVENT + 47))).rejects.toThrow(/settler enters the result first/);
    await expect(proposeResult(db, Cem, id, "no", at(EVENT + 49))).rejects.toThrow(/about you/);
    await proposeResult(db, Ada, id, "yes", at(EVENT + 49));
  });

  it("lets anyone settle straight away if the settler left", async () => {
    const { users, groupId } = await group(["Ada", "Bo", "Cem"]);
    const { Ada, Bo, Cem } = users;
    const id = await createCall(db, Ada, groupId, call(), T0);
    await pick(db, Bo, id, "yes", at(1));
    await pick(db, Ada, id, "yes", at(1));
    expect((await tick(id, at(LOCK))).settlerId).toBe(Cem.id);
    await leaveGroup(db, Cem, groupId, at(30));
    await proposeResult(db, Bo, id, "no", at(EVENT));
  });

  it("finalises an undisputed result after 24 hours", async () => {
    const { users, groupId } = await group(["Ada", "Bo", "Cem"]);
    const { Ada, Bo, Cem } = users;
    const id = await createCall(db, Ada, groupId, call(), T0);
    await pick(db, Bo, id, "yes", at(1));
    await pick(db, Ada, id, "no", at(1));
    await tick(id, at(LOCK));
    await proposeResult(db, Cem, id, "yes", at(EVENT));
    expect((await tick(id, at(EVENT + 23))).status).toBe("proposed");
    const r = await tick(id, at(EVENT + 24));
    expect(r.status).toBe("settled");
    expect(r.result).toBe("yes");
    expect(r.nextActionAt).toBeNull();

    const v = await view(Ada, groupId, id, at(EVENT + 24));
    expect(v.whoPicked).toEqual({ yes: ["Bo"], no: ["Ada"] });
  });

  it("can be settled as void (didn't happen / unclear)", async () => {
    const { users, groupId } = await group(["Ada", "Bo", "Cem"]);
    const { Ada, Cem } = users;
    const id = await createCall(db, Ada, groupId, call(), T0);
    await tick(id, at(LOCK));
    const settler = (await row(id)).settlerId === Cem.id ? Cem : users.Bo;
    await proposeResult(db, settler, id, "void", at(EVENT));
    const r = await tick(id, at(EVENT + 24));
    expect(r.status).toBe("void");
    expect(r.voidReason).toBe("settler");
  });

  it("voids calls nobody settles within 7 days", async () => {
    const { users, groupId } = await group(["Ada", "Bo"]);
    const id = await createCall(db, users.Ada, groupId, call(), T0);
    await tick(id, at(LOCK));
    expect((await tick(id, at(EVENT + 7 * 24 - 1))).status).toBe("active");
    const r = await tick(id, at(EVENT + 7 * 24));
    expect(r.status).toBe("void");
    expect(r.voidReason).toBe("not settled in time");
  });

  it("applies due steps even if the job runner hasn't run yet", async () => {
    const { users, groupId } = await group(["Ada", "Bo", "Cem"]);
    const { Ada, Bo, Cem } = users;
    const id = await createCall(db, Ada, groupId, call(), T0);
    await pick(db, Bo, id, "yes", at(1));
    await pick(db, Ada, id, "yes", at(1));
    // No tick: the settler is chosen inside proposeResult.
    await proposeResult(db, Cem, id, "yes", at(EVENT));
    expect((await row(id)).settlerId).toBe(Cem.id);
  });
});

describe("disputes", () => {
  /** Ada writes; Bo, Cem, Dee, Eve pick; Fay is neutral and settles. */
  async function proposed(result = "yes") {
    const { users, groupId } = await group(["Ada", "Bo", "Cem", "Dee", "Eve", "Fay"]);
    const { Ada, Bo, Cem, Dee, Eve, Fay } = users;
    const id = await createCall(db, Ada, groupId, call(), T0);
    await pick(db, Bo, id, "yes", at(1));
    await pick(db, Cem, id, "no", at(1));
    await pick(db, Dee, id, "no", at(1));
    await pick(db, Eve, id, "yes", at(1));
    expect((await tick(id, at(LOCK))).settlerId).toBe(Fay.id);
    await proposeResult(db, Fay, id, result, at(EVENT));
    return { users, groupId, id, Ada, Bo, Cem, Dee, Eve, Fay };
  }

  it("only lets people who picked dispute, within 24 hours, with a different answer", async () => {
    const { id, Ada, Cem, Fay } = await proposed();
    await expect(disputeResult(db, Fay, id, "no", at(EVENT + 1))).rejects.toThrow(/You entered this result/);
    await expect(disputeResult(db, Ada, id, "no", at(EVENT + 1))).rejects.toThrow(/Only people who picked/);
    await expect(disputeResult(db, Cem, id, "yes", at(EVENT + 1))).rejects.toThrow(/already entered/);
    await expect(disputeResult(db, Cem, id, "no", at(EVENT + 24))).rejects.toThrow(/has passed/);
  });

  it("overturns the result when a majority of votes disagree", async () => {
    const { id, Bo, Cem, Dee, Eve, Ada, groupId } = await proposed("yes");
    await disputeResult(db, Cem, id, "no", at(EVENT + 1));
    await voteOnResult(db, Dee, id, "no", at(EVENT + 2));
    await voteOnResult(db, Bo, id, "yes", at(EVENT + 3));
    const during = await view(Ada, groupId, id, at(EVENT + 3));
    expect(during.votesCast).toBe(3);
    expect(during.eligibleVoters).toBe(4);
    expect(during.voteTally).toBeNull(); // hidden while the vote runs
    await expect(voteOnResult(db, Dee, id, "yes", at(EVENT + 4))).rejects.toThrow(/already voted/);
    await voteOnResult(db, Eve, id, "no", at(EVENT + 4)); // everyone voted: closes early
    const r = await row(id);
    expect(r.status).toBe("settled");
    expect(r.result).toBe("no");
    expect((await view(Ada, groupId, id, at(EVENT + 4))).voteTally).toEqual({ no: 3, yes: 1 });
  });

  it("voids on a tie instead of keeping the settler's answer", async () => {
    const { id, Bo, Cem } = await proposed("yes");
    await disputeResult(db, Cem, id, "no", at(EVENT + 1));
    await voteOnResult(db, Bo, id, "yes", at(EVENT + 2));
    const r = await tick(id, at(EVENT + 1 + 24));
    expect(r.status).toBe("void");
    expect(r.voidReason).toBe("vote");
  });

  it("voids when the disputer is the only one who votes", async () => {
    const { id, Cem } = await proposed("yes");
    await disputeResult(db, Cem, id, "no", at(EVENT + 1));
    expect((await tick(id, at(EVENT + 25))).status).toBe("void");
  });

  it("keeps the settler, the subject and non-pickers out of the vote", async () => {
    const { id, Ada, Cem, Fay } = await proposed("yes");
    await disputeResult(db, Cem, id, "no", at(EVENT + 1));
    await expect(voteOnResult(db, Fay, id, "yes", at(EVENT + 2))).rejects.toThrow(/Only people who picked/);
    await expect(voteOnResult(db, Ada, id, "yes", at(EVENT + 2))).rejects.toThrow(/Only people who picked/);
  });

  it("refuses votes after the vote closed, even before the job runner ran", async () => {
    const { id, Bo, Cem } = await proposed("yes");
    await disputeResult(db, Cem, id, "no", at(EVENT + 1));
    await expect(voteOnResult(db, Bo, id, "yes", at(EVENT + 26))).rejects.toThrow(/no vote open/);
    expect((await tick(id, at(EVENT + 26))).status).toBe("void"); // the refused request changed nothing; the runner closes it
  });
});

describe("the job runner", () => {
  it("only touches calls that are due, and is safe to run repeatedly", async () => {
    const { users, groupId } = await group(["Ada", "Bo"]);
    const id = await createCall(db, users.Ada, groupId, call(), T0);
    const before = await runDueCalls(db, at(1));
    expect((await row(id)).settlerId).toBeNull();
    expect(before.advanced).toBeGreaterThanOrEqual(0);
    await runDueCalls(db, at(LOCK));
    await runDueCalls(db, at(LOCK));
    expect((await row(id)).settlerId).toBe(users.Bo.id);
  });
});
