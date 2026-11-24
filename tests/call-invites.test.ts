import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { User } from "@/server/auth";
import { callInvitePreview, createCallInvite, joinWithCallInvite } from "@/server/call-invites";
import { cancelCall, createCall, pick } from "@/server/calls";
import { members, picks } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createGroup, groupForMember, joinGroup, leaveGroup } from "@/server/groups";
import { removeMember } from "@/server/moderation";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const T0 = new Date("2026-10-05T09:00:00Z");
const H = 3600_000;
const at = (h: number) => new Date(T0.getTime() + h * H);
let n = 0;
const ip = () => `10.2.${Math.floor(++n / 250)}.${n % 250}`;

/** Egemen (admin), Burcu and Fehmi in "Saturday crew", plus Arda who isn't in it yet. */
async function crew() {
  const u: Record<string, User> = {};
  for (const name of ["Egemen", "Burcu", "Fehmi", "Arda"]) u[name] = (await signUp(db, name)).user;
  const groupId = await createGroup(db, u.Egemen, { name: "Saturday crew", timeZone: "UTC", displayName: "Egemen" }, T0);
  const invite = (await groupForMember(db, u.Egemen, groupId)).inviteToken!;
  for (const name of ["Burcu", "Fehmi"]) await joinGroup(db, u[name], invite, name, ip(), T0);
  const late = await createCall(db, u.Egemen, groupId, { text: "Who'll be late on Saturday?", kind: "member", lockAt: at(48), eventAt: at(50) }, T0);
  return { u, groupId, late };
}

describe("call invites", () => {
  it("lets any member share an open call; one link per person per call", async () => {
    const { u, late } = await crew();
    const token = await createCallInvite(db, u.Burcu, late, at(1));
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await createCallInvite(db, u.Burcu, late, at(2))).toBe(token);
    expect(await createCallInvite(db, u.Fehmi, late, at(2))).not.toBe(token);
    await expect(createCallInvite(db, u.Arda, late, at(1))).rejects.toThrow(/doesn.t exist/);
  });

  it("shows the call, the options and who picked, never what they picked", async () => {
    const { u, late } = await crew();
    await pick(db, u.Burcu, late, u.Fehmi.id, at(1));
    await pick(db, u.Fehmi, late, u.Egemen.id, at(2));
    const token = await createCallInvite(db, u.Egemen, late, at(3));
    const p = await callInvitePreview(db, token, null, null, at(3));
    expect(p).toMatchObject({
      groupName: "Saturday crew",
      memberCount: 3,
      sharerName: "Egemen",
      text: "Who'll be late on Saturday?",
      kind: "member",
      pickers: ["Burcu", "Fehmi"],
      alreadyMember: false,
    });
    expect(p!.options.map((o) => o.label).sort()).toEqual(["Burcu", "Egemen", "Fehmi"]);
    expect(JSON.stringify(p)).not.toMatch(/optionKey|myPick|split/);
  });

  it("joins the group and locks in the pick in one go", async () => {
    const { u, groupId, late } = await crew();
    const token = await createCallInvite(db, u.Burcu, late, at(1));
    expect(await joinWithCallInvite(db, u.Arda, token, "Arda", u.Burcu.id, ip(), at(2))).toBe(groupId);
    const [m] = await db.select().from(members).where(and(eq(members.groupId, groupId), eq(members.userId, u.Arda.id)));
    expect(m).toMatchObject({ displayName: "Arda", role: "member", leftAt: null });
    const [p] = await db.select().from(picks).where(and(eq(picks.callId, late), eq(picks.userId, u.Arda.id)));
    expect(p.optionKey).toBe(u.Burcu.id);
    expect((await callInvitePreview(db, token, null, u.Arda, at(3)))!.alreadyMember).toBe(true);
  });

  it("joins without a pick, and rejects options that aren't on the call", async () => {
    const { u, groupId, late } = await crew();
    const token = await createCallInvite(db, u.Burcu, late, at(1));
    await expect(joinWithCallInvite(db, u.Arda, token, "Arda", "nobody", ip(), at(2))).rejects.toThrow(/isn't one of the options/);
    expect(await joinWithCallInvite(db, u.Arda, token, "Arda", null, ip(), at(2))).toBe(groupId);
  });

  it("stops working once picks close, the call is cancelled, or the sharer leaves", async () => {
    const a = await crew();
    const t1 = await createCallInvite(db, a.u.Burcu, a.late, at(1));
    expect(await callInvitePreview(db, t1, null, null, at(48))).toBeNull();
    await expect(joinWithCallInvite(db, a.u.Arda, t1, "Arda", null, ip(), at(48))).rejects.toThrow(/invite has closed/);

    const b = await crew();
    const t2 = await createCallInvite(db, b.u.Burcu, b.late, at(1));
    await cancelCall(db, b.u.Egemen, b.late, at(2));
    expect(await callInvitePreview(db, t2, null, null, at(3))).toBeNull();

    const c = await crew();
    const t3 = await createCallInvite(db, c.u.Burcu, c.late, at(1));
    await leaveGroup(db, c.u.Burcu, c.groupId, at(2));
    expect(await callInvitePreview(db, t3, null, null, at(3))).toBeNull();
  });

  it("keeps the group's own rules: removed people can't come back through a call", async () => {
    const { u, groupId, late } = await crew();
    await removeMember(db, u.Egemen, groupId, u.Fehmi.id, at(1));
    const token = await createCallInvite(db, u.Burcu, late, at(2));
    await expect(joinWithCallInvite(db, u.Fehmi, token, "Fehmi", u.Burcu.id, ip(), at(3))).rejects.toThrow(/removed you/);
  });

  it("calls about a person can only be shared by that person", async () => {
    const { u, groupId } = await crew();
    const about = await createCall(db, u.Egemen, groupId, { text: "Will Burcu catch the bouquet?", kind: "yes_no", subjectId: u.Burcu.id, lockAt: at(48), eventAt: at(50) }, T0);
    await expect(createCallInvite(db, u.Fehmi, about, at(1))).rejects.toThrow(/Only the person this call is about/);
    const token = await createCallInvite(db, u.Burcu, about, at(1));
    expect((await callInvitePreview(db, token, null, null, at(2)))!.text).toBe("Will Burcu catch the bouquet?");
  });

  it("ignores made-up tokens", async () => {
    expect(await callInvitePreview(db, "not-a-token", null, null, at(1))).toBeNull();
    expect(await callInvitePreview(db, "A".repeat(22), null, null, at(1))).toBeNull();
  });
});
