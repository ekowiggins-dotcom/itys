import { beforeAll, describe, expect, it } from "vitest";
import { cancelCall, callsForMember, createCall, pick, unpick, type NewCall } from "@/server/calls";
import type { User } from "@/server/auth";
import type { Db } from "@/server/db/types";
import { createGroup, groupForMember, joinGroup, leaveGroup } from "@/server/groups";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const T0 = new Date("2026-06-01T12:00:00Z");
const H = 3600_000;
const at = (hours: number) => new Date(T0.getTime() + hours * H);

let ipN = 0;
/** A group with an admin (Ada) and two friends (Bo, Cem). */
async function setup() {
  const ada = (await signUp(db, "Ada")).user;
  const bo = (await signUp(db, "Bo")).user;
  const cem = (await signUp(db, "Cem")).user;
  const groupId = await createGroup(db, ada, { name: "Flat", timeZone: "UTC", displayName: "Ada" }, T0);
  const invite = (await groupForMember(db, ada, groupId)).inviteToken!;
  await joinGroup(db, bo, invite, "Bo", `7.7.7.${++ipN}`, T0);
  await joinGroup(db, cem, invite, "Cem", `7.7.7.${++ipN}`, T0);
  return { ada, bo, cem, groupId };
}

const yesNo = (extra: Partial<NewCall> = {}): NewCall => ({
  text: "Will it rain on Saturday?",
  kind: "yes_no",
  lockAt: at(24),
  eventAt: at(48),
  ...extra,
});

async function viewOf(user: User, groupId: string, callId: string, now = T0) {
  const list = await callsForMember(db, user, groupId, now);
  const v = list.find((c) => c.id === callId);
  if (!v) throw new Error("call not visible");
  return v;
}

describe("making calls", () => {
  it("creates yes/no, choice and 'who' calls", async () => {
    const { ada, bo, groupId } = await setup();
    const a = await createCall(db, ada, groupId, yesNo(), T0);
    const b = await createCall(db, ada, groupId, yesNo({ text: "Where will we eat?", kind: "choice", options: ["Pizza", "Sushi", ""] }), T0);
    const c = await createCall(db, ada, groupId, yesNo({ text: "Who will be late?", kind: "member", subjectId: bo.id }), T0);

    expect((await viewOf(ada, groupId, a)).options.map((o) => o.label)).toEqual(["Yes", "No"]);
    expect((await viewOf(ada, groupId, b)).options).toEqual([
      { key: "o1", label: "Pizza" },
      { key: "o2", label: "Sushi" },
    ]);
    const who = await viewOf(ada, groupId, c);
    expect(who.options.map((o) => o.label)).toEqual(["Ada", "Cem"]); // the subject (Bo) is not an option
    expect(who.subject).toBe("Bo");
  });

  it("requires picks to stay open at least an hour, and the result after picks close", async () => {
    const { ada, groupId } = await setup();
    await expect(createCall(db, ada, groupId, yesNo({ lockAt: at(0.5) }), T0)).rejects.toThrow(/at least an hour/);
    await expect(createCall(db, ada, groupId, yesNo({ lockAt: at(24), eventAt: at(23) }), T0)).rejects.toThrow(/before picks close/);
  });

  it("rejects bad options", async () => {
    const { ada, groupId } = await setup();
    const choice = (options: string[]) => yesNo({ kind: "choice", options });
    await expect(createCall(db, ada, groupId, choice(["Only one"]), T0)).rejects.toThrow(/2 to 4/);
    await expect(createCall(db, ada, groupId, choice(["A", "B", "C", "D", "E"]), T0)).rejects.toThrow(/2 to 4/);
    await expect(createCall(db, ada, groupId, choice(["Same", "same"]), T0)).rejects.toThrow(/different/);
  });

  it("only allows members of the group as the subject", async () => {
    const { ada, groupId } = await setup();
    const stranger = (await signUp(db, "Stranger")).user;
    await expect(createCall(db, ada, groupId, yesNo({ subjectId: stranger.id }), T0)).rejects.toThrow(/must be in the group/);
  });

  it("hides calls from non-members", async () => {
    const { ada, groupId } = await setup();
    const id = await createCall(db, ada, groupId, yesNo(), T0);
    const outsider = (await signUp(db, "Outsider")).user;
    await expect(createCall(db, outsider, groupId, yesNo(), T0)).rejects.toMatchObject({ code: "not_found" });
    await expect(callsForMember(db, outsider, groupId, T0)).rejects.toMatchObject({ code: "not_found" });
    await expect(pick(db, outsider, id, "yes", T0)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("picking", () => {
  it("lets members pick, change and take back their pick until lock", async () => {
    const { ada, bo, groupId } = await setup();
    const id = await createCall(db, ada, groupId, yesNo(), T0);
    await pick(db, bo, id, "yes", at(1));
    expect((await viewOf(bo, groupId, id, at(1))).myPick).toBe("yes");
    await pick(db, bo, id, "no", at(2));
    expect((await viewOf(bo, groupId, id, at(2))).myPick).toBe("no");
    await unpick(db, bo, id, at(3));
    expect((await viewOf(bo, groupId, id, at(3))).myPick).toBeNull();
  });

  it("refuses picks after lock and unknown options", async () => {
    const { ada, bo, groupId } = await setup();
    const id = await createCall(db, ada, groupId, yesNo(), T0);
    await expect(pick(db, bo, id, "maybe", at(1))).rejects.toThrow(/isn't one of the options/);
    await expect(pick(db, bo, id, "yes", at(24))).rejects.toThrow(/closed/);
    await expect(unpick(db, bo, id, at(25))).rejects.toThrow(/closed/);
  });

  it("doesn't let the subject pick on a call about them", async () => {
    const { ada, bo, groupId } = await setup();
    const id = await createCall(db, ada, groupId, yesNo({ text: "Will Bo pass the test?", subjectId: bo.id }), T0);
    await expect(pick(db, bo, id, "yes", at(1))).rejects.toThrow(/about you/);
    const v = await viewOf(bo, groupId, id, at(1));
    expect(v.isAboutMe).toBe(true);
    expect(v.canPick).toBe(false);
    expect(v.eligibleCount).toBe(2);
  });

  it("stops people who left from picking", async () => {
    const { ada, cem, groupId } = await setup();
    const id = await createCall(db, ada, groupId, yesNo(), T0);
    await leaveGroup(db, cem, groupId, at(1));
    await expect(pick(db, cem, id, "yes", at(2))).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("the split stays hidden until picks close", () => {
  it("shows only how many picked before lock, even to people who already picked", async () => {
    const { ada, bo, cem, groupId } = await setup();
    const id = await createCall(db, ada, groupId, yesNo(), T0);
    await pick(db, bo, id, "yes", at(1));
    await pick(db, cem, id, "yes", at(1));

    // Regression for the old app: picking used to reveal the split, and picks could still change.
    const bosView = await viewOf(bo, groupId, id, at(2));
    expect(bosView.myPick).toBe("yes");
    expect(bosView.pickCount).toBe(2);
    expect(bosView.split).toBeNull();
    expect(JSON.stringify(bosView)).not.toContain('"yes":2');

    const afterLock = await viewOf(ada, groupId, id, at(24));
    expect(afterLock.locked).toBe(true);
    expect(afterLock.split).toEqual({ yes: 2 });
  });

  it("lists open calls first, closing soonest, then closed calls", async () => {
    const { ada, groupId } = await setup();
    const later = await createCall(db, ada, groupId, yesNo({ text: "Closes later", lockAt: at(48), eventAt: at(48) }), T0);
    const sooner = await createCall(db, ada, groupId, yesNo({ text: "Closes sooner", lockAt: at(5), eventAt: at(6) }), T0);
    const ids = (await callsForMember(db, ada, groupId, at(6))).map((c) => c.id);
    expect(ids.indexOf(later)).toBeLessThan(ids.indexOf(sooner));
    const ids2 = (await callsForMember(db, ada, groupId, at(1))).map((c) => c.id);
    expect(ids2.indexOf(sooner)).toBeLessThan(ids2.indexOf(later));
  });
});

describe("cancelling", () => {
  it("lets the author or the admin cancel before lock, nobody else", async () => {
    const { ada, bo, cem, groupId } = await setup();
    const bosCall = await createCall(db, bo, groupId, yesNo(), T0);
    await expect(cancelCall(db, cem, bosCall, at(1))).rejects.toMatchObject({ code: "forbidden" });
    await cancelCall(db, ada, bosCall, at(1)); // admin
    expect((await callsForMember(db, ada, groupId, at(1))).some((c) => c.id === bosCall)).toBe(false);
    await expect(pick(db, cem, bosCall, "yes", at(2))).rejects.toThrow(/no longer open/);

    const another = await createCall(db, bo, groupId, yesNo(), T0);
    await cancelCall(db, bo, another, at(1)); // author
  });

  it("can't cancel after picks close", async () => {
    const { ada, groupId } = await setup();
    const id = await createCall(db, ada, groupId, yesNo(), T0);
    await expect(cancelCall(db, ada, id, at(24))).rejects.toThrow(/settled instead/);
  });
});

describe("names", () => {
  it("keeps showing a member's group name in 'who' options after they leave", async () => {
    const { ada, cem, groupId } = await setup();
    const id = await createCall(db, ada, groupId, yesNo({ text: "Who will cook?", kind: "member" }), T0);
    await leaveGroup(db, cem, groupId, at(1));
    const labels = (await viewOf(ada, groupId, id, at(2))).options.map((o) => o.label);
    expect(labels).toContain("Cem"); // still listed with the name they had while a member
  });
});
