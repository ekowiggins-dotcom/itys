import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { deleteAccount } from "@/server/account";
import type { User } from "@/server/auth";
import { createCall, pick, type NewCall } from "@/server/calls";
import { calls } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createGroup, groupForMember, joinGroup, leaveGroup } from "@/server/groups";
import { proposeResult, runDueCalls } from "@/server/lifecycle";
import { reportCall, reviewCall } from "@/server/moderation";
import { createShareLink, publicResult } from "@/server/sharing";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const T0 = new Date("2026-10-05T09:00:00Z");
const H = 3600_000;
const at = (h: number) => new Date(T0.getTime() + h * H);
let n = 0;

async function group() {
  const u: Record<string, User> = {};
  for (const name of ["Ada", "Bo", "Cem", "Dee"]) u[name] = (await signUp(db, name)).user;
  const groupId = await createGroup(db, u.Ada, { name: "Secret Club", timeZone: "UTC", displayName: "Ada" }, T0);
  const invite = (await groupForMember(db, u.Ada, groupId)).inviteToken!;
  for (const name of ["Bo", "Cem", "Dee"]) await joinGroup(db, u[name], invite, name, `1.1.${Math.floor(++n / 250)}.${n % 250}`, T0);
  return { u, groupId };
}

/** Creates a call, has Ada pick `adaPicks` and Bo pick the other answer, and settles it with `result`. */
async function settled(u: Record<string, User>, groupId: string, call: Partial<NewCall>, picksBy: [User, string][], result: string) {
  const id = await createCall(db, u.Ada, groupId, { text: "Will the band play an encore?", kind: "yes_no", lockAt: at(2), eventAt: at(2), ...call }, T0);
  for (const [who, answer] of picksBy) await pick(db, who, id, answer, at(1));
  await runDueCalls(db, at(2));
  const [c] = await db.select().from(calls).where(eq(calls.id, id));
  await proposeResult(db, Object.values(u).find((x) => x.id === c.settlerId)!, id, result, at(3));
  await runDueCalls(db, at(28));
  return id;
}

describe("sharing results", () => {
  it("shows the call, the answer, counts and the sharer's own result: no other names, no group name", async () => {
    const { u, groupId } = await group();
    const id = await settled(u, groupId, {}, [[u.Ada, "yes"], [u.Bo, "no"], [u.Cem, "no"]], "yes");
    const token = await createShareLink(db, u.Ada, id, at(29));
    expect(await createShareLink(db, u.Ada, id, at(30))).toBe(token); // one link per person per call
    const r = await publicResult(db, token, null);
    expect(r).toEqual({
      text: "Will the band play an encore?",
      answer: "Yes",
      pickers: 3,
      rightCount: 1,
      sharerName: "Ada",
      sharerCalledIt: true,
      sharerPoints: 30,
      color: expect.stringMatching(/^#[0-9A-F]{6}$/),
      sharerColor: expect.stringMatching(/^#[0-9A-F]{6}$/),
    });
    const json = JSON.stringify(r);
    for (const secret of ["Bo", "Cem", "Secret Club"]) expect(json).not.toContain(secret);
  });

  it("can't share before the result is in", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Ada, groupId, { text: "Will it be sunny?", kind: "yes_no", lockAt: at(2), eventAt: at(4) }, T0);
    await expect(createShareLink(db, u.Bo, id, at(1))).rejects.toThrow(/once it has a result/);
  });

  it("only lets the person a call is about share it", async () => {
    const { u, groupId } = await group();
    const id = await settled(u, groupId, { text: "Will Bo finish the marathon?", subjectId: u.Bo.id }, [[u.Ada, "yes"], [u.Cem, "no"]], "yes");
    await expect(createShareLink(db, u.Ada, id, at(29))).rejects.toThrow(/Only the person this call is about/);
    const token = await createShareLink(db, u.Bo, id, at(29));
    expect((await publicResult(db, token, null))?.sharerCalledIt).toBeNull(); // Bo couldn't pick
  });

  it("only lets the person a 'who' call named share it", async () => {
    const { u, groupId } = await group();
    const id = await settled(u, groupId, { text: "Who will burn the toast?", kind: "member" }, [[u.Bo, u.Cem.id], [u.Dee, u.Ada.id]], u.Cem.id);
    await expect(createShareLink(db, u.Bo, id, at(29))).rejects.toThrow();
    const token = await createShareLink(db, u.Cem, id, at(29));
    expect((await publicResult(db, token, null))?.answer).toBe("Cem");
  });

  it("goes dark when the call is removed, the sharer leaves, or deletes their account", async () => {
    const { u, groupId } = await group();
    const a = await settled(u, groupId, { text: "Will the cat come home?" }, [[u.Ada, "yes"], [u.Bo, "no"]], "yes");
    const t1 = await createShareLink(db, u.Bo, a, at(29));
    await reportCall(db, u.Cem, a, "hurtful", at(30));
    await reportCall(db, u.Dee, a, "hurtful", at(30));
    expect(await publicResult(db, t1, null)).toBeNull(); // hidden for review
    await reviewCall(db, u.Bo, a, "remove", at(31)); // Ada wrote it, so Bo reviews
    expect(await publicResult(db, t1, null)).toBeNull();

    const b = await settled(u, groupId, { text: "Will the oven be fixed?" }, [[u.Ada, "yes"], [u.Bo, "no"]], "no");
    const t2 = await createShareLink(db, u.Bo, b, at(29));
    expect(await publicResult(db, t2, null)).not.toBeNull();
    await leaveGroup(db, u.Bo, groupId, at(32));
    expect(await publicResult(db, t2, null)).toBeNull();

    const c = await settled(u, groupId, { text: "Will Dee win quiz night?" }, [[u.Ada, "yes"], [u.Dee, "no"]], "no");
    const t3 = await createShareLink(db, u.Dee, c, at(29));
    await deleteAccount(db, u.Dee, at(33));
    expect(await publicResult(db, t3, null)).toBeNull();
  });

  it("returns nothing for made-up tokens and rate-limits viewers", async () => {
    expect(await publicResult(db, "x".repeat(22), null)).toBeNull();
    expect(await publicResult(db, "../etc", null)).toBeNull();
    for (let i = 0; i < 120; i++) await publicResult(db, "y".repeat(22), "9.8.7.6");
    await expect(publicResult(db, "y".repeat(22), "9.8.7.6")).rejects.toThrow(/Too many/);
  });
});
