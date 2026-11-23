import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { User } from "@/server/auth";
import { createCall, pick } from "@/server/calls";
import { notifications, outbox, users } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { backoffMs, deliverOutbox, MAX_ATTEMPTS } from "@/server/delivery";
import { createGroup, groupForMember, joinGroup, leaveGroup } from "@/server/groups";
import { disputeResult, proposeResult, runDueCalls } from "@/server/lifecycle";
import { inbox, markAllRead, unreadCount } from "@/server/notifications";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const T0 = new Date("2026-08-03T09:00:00Z");
const H = 3600_000;
const at = (h: number) => new Date(T0.getTime() + h * H);
let n = 0;

async function group(names = ["Ada", "Bo", "Cem", "Dee"]) {
  const u: Record<string, User> = {};
  for (const name of names) u[name] = (await signUp(db, name)).user;
  const groupId = await createGroup(db, u[names[0]], { name: "Notify", timeZone: "UTC", displayName: names[0] }, T0);
  const invite = (await groupForMember(db, u[names[0]], groupId)).inviteToken!;
  for (const name of names.slice(1)) await joinGroup(db, u[name], invite, name, `4.4.${Math.floor(++n / 250)}.${n % 250}`, T0);
  return { u, groupId };
}

const texts = async (user: User) => (await inbox(db, user)).map((x) => x.text);

describe("who gets told what", () => {
  it("tells others about a new call, and the subject that it's about them", async () => {
    const { u, groupId } = await group();
    await createCall(db, u.Ada, groupId, { text: "Will Bo run the marathon?", kind: "yes_no", subjectId: u.Bo.id, lockAt: at(24), eventAt: at(48) }, T0);
    expect(await texts(u.Cem)).toContain("Ada made a new call: “Will Bo run the marathon?”");
    expect(await texts(u.Bo)).toContain("Ada made a call about you: “Will Bo run the marathon?”");
    expect((await texts(u.Ada)).some((t) => t.includes("marathon"))).toBe(false); // not the author
  });

  it("reminds only people who haven't picked, 2 hours before lock, once", async () => {
    const { u, groupId } = await group();
    const id = await createCall(db, u.Ada, groupId, { text: "Will it rain?", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, T0);
    await pick(db, u.Bo, id, "yes", at(1));
    await runDueCalls(db, at(21)); // too early
    expect(await texts(u.Cem)).not.toContain("Picks close in 2 hours: “Will it rain?”");
    await runDueCalls(db, at(22));
    await runDueCalls(db, at(23));
    const cem = await texts(u.Cem);
    expect(cem.filter((t) => t === "Picks close in 2 hours: “Will it rain?”")).toHaveLength(1);
    expect(await texts(u.Bo)).not.toContain("Picks close in 2 hours: “Will it rain?”");
  });

  it("skips the reminder for calls that close within 3 hours of being made", async () => {
    const { u, groupId } = await group();
    await createCall(db, u.Ada, groupId, { text: "Pizza tonight?", kind: "yes_no", lockAt: at(2), eventAt: at(4) }, T0);
    await runDueCalls(db, at(1));
    expect((await texts(u.Cem)).some((t) => t.startsWith("Picks close"))).toBe(false);
  });

  it("follows a call to the end: settle prompt, proposed result, vote, result with points", async () => {
    const { u, groupId } = await group(["Ada", "Bo", "Cem", "Dee", "Eve"]);
    const id = await createCall(db, u.Ada, groupId, { text: "Will the train be late?", kind: "yes_no", lockAt: at(24), eventAt: at(30) }, T0);
    await pick(db, u.Bo, id, "yes", at(1));
    await pick(db, u.Cem, id, "no", at(1));
    await pick(db, u.Dee, id, "no", at(1));
    await runDueCalls(db, at(24)); // Eve: neutral settler
    expect(await texts(u.Eve)).not.toContain("Time to settle “Will the train be late?”. What happened?");
    await runDueCalls(db, at(30));
    expect(await texts(u.Eve)).toContain("Time to settle “Will the train be late?”. What happened?");

    await proposeResult(db, u.Eve, id, "yes", at(31));
    expect(await texts(u.Cem)).toContain("Eve says “Yes” for “Will the train be late?”. You have 24 hours to dispute it.");

    await disputeResult(db, u.Cem, id, "no", at(32));
    expect(await texts(u.Dee)).toContain("Cem disputed the result of “Will the train be late?”. Vote on what really happened.");
    expect((await texts(u.Cem)).some((t) => t.includes("disputed"))).toBe(false); // not the disputer
    expect((await texts(u.Eve)).some((t) => t.includes("disputed"))).toBe(false); // not the proposer: can't vote

    await runDueCalls(db, at(32 + 24)); // only Cem voted: called off
    expect(await texts(u.Bo)).toContain("“Will the train be late?” was called off. Nobody scores.");
  });

  it("tells pickers the result and their points, without revealing anyone's pick", async () => {
    const { u, groupId } = await group(["Ada", "Bo", "Cem", "Dee"]);
    const id = await createCall(db, u.Ada, groupId, { text: "Will Cem win chess?", kind: "yes_no", lockAt: at(24), eventAt: at(24) }, T0);
    await pick(db, u.Bo, id, "yes", at(1));
    await pick(db, u.Ada, id, "no", at(1));
    await runDueCalls(db, at(24));
    await proposeResult(db, await settlerOf(id, u), id, "yes", at(25));
    await runDueCalls(db, at(49));
    const bo = await texts(u.Bo);
    expect(bo).toContain("Result for “Will Cem win chess?”: Yes. +25 for you!");
    expect(await texts(u.Ada)).toContain("Result for “Will Cem win chess?”: Yes.");
    for (const t of [...bo, ...(await texts(u.Ada))]) expect(t).not.toMatch(/Bo picked|Ada picked/);
  });

  it("tells members when someone joins", async () => {
    const { u } = await group(["Ada", "Bo"]);
    expect(await texts(u.Ada)).toContain("Bo joined Notify.");
  });
});

async function settlerOf(callId: string, u: Record<string, User>) {
  const { calls } = await import("@/server/db/schema");
  const [c] = await db.select().from(calls).where(eq(calls.id, callId));
  return Object.values(u).find((x) => x.id === c.settlerId)!;
}

describe("reading", () => {
  it("counts unread, marks read up to a moment, and hides groups you left", async () => {
    const { u, groupId } = await group();
    await createCall(db, u.Ada, groupId, { text: "First call here", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, T0);
    const before = await unreadCount(db, u.Cem);
    expect(before).toBeGreaterThan(0);
    await markAllRead(db, u.Cem, at(1), at(1));
    expect(await unreadCount(db, u.Cem)).toBe(0);
    await createCall(db, u.Ada, groupId, { text: "Second call here", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, at(2));
    expect(await unreadCount(db, u.Cem)).toBe(1); // arrived after the mark

    await leaveGroup(db, u.Cem, groupId, at(3));
    expect(await unreadCount(db, u.Cem)).toBe(0);
    expect(await inbox(db, u.Cem)).toEqual([]);
  });

  it("shows current names, not the names at the time", async () => {
    const { u } = await group(["Ada", "Bo"]);
    const { members } = await import("@/server/db/schema");
    await db.update(members).set({ displayName: "Bobby" }).where(eq(members.userId, u.Bo.id));
    expect(await texts(u.Ada)).toContain("Bobby joined Notify.");
  });
});

describe("email delivery", () => {
  async function queued() {
    const { u, groupId } = await group();
    await createCall(db, u.Ada, groupId, { text: "Will Dee learn to juggle?", kind: "yes_no", subjectId: u.Dee.id, lockAt: at(24), eventAt: at(48) }, T0);
    const [row] = await db
      .select({ id: outbox.id })
      .from(outbox)
      .innerJoin(notifications, eq(notifications.id, outbox.notificationId))
      .where(eq(notifications.userId, u.Dee.id));
    return { u, groupId, outboxId: row.id };
  }
  const status = async (id: string) => (await db.select().from(outbox).where(eq(outbox.id, id)))[0];

  it("emails only 'needs you' events, once", async () => {
    const { u, outboxId } = await queued();
    const mails: { to: string; subject: string; text: string }[] = [];
    await deliverOutbox(db, async (to, subject, text) => void mails.push({ to, subject, text }), at(0.1));
    await deliverOutbox(db, async (to, subject, text) => void mails.push({ to, subject, text }), at(0.2));
    const mine = mails.filter((m) => m.to === u.Dee.email);
    expect(mine).toHaveLength(1);
    expect(mine[0].text).toContain("Ada made a call about you: “Will Dee learn to juggle?”");
    expect(mails.some((m) => m.to === u.Cem.email)).toBe(false); // a plain new call: in-app only
    expect((await status(outboxId)).status).toBe("sent");
  });

  it("retries failures with backoff, then gives up", async () => {
    const { outboxId } = await queued();
    const fail = async () => {
      throw new Error("provider down");
    };
    let t = at(0.1).getTime();
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      await deliverOutbox(db, fail, new Date(t));
      const r = await status(outboxId);
      expect(r.attempts).toBe(i);
      expect(r.status).toBe(i < MAX_ATTEMPTS ? "queued" : "failed");
      expect(r.lastError).toBe("provider down");
      t += backoffMs(i);
    }
  });

  it("picks up a send that crashed mid-way once its lease expires", async () => {
    const { outboxId } = await queued();
    // A worker claimed it and died: still "sending" with a lease in the past.
    await db.update(outbox).set({ status: "sending", leaseUntil: at(0), attempts: 1 }).where(eq(outbox.id, outboxId));
    let sent = 0;
    await deliverOutbox(db, async () => void sent++, at(0.5));
    expect((await status(outboxId)).status).toBe("sent");
    expect(sent).toBeGreaterThan(0);
  });

  it("doesn't send a 'time to settle' email once the call already has a result", async () => {
    const { u, groupId } = await group(["Ada", "Bo", "Cem"]);
    const id = await createCall(db, u.Ada, groupId, { text: "Will the cake rise?", kind: "yes_no", lockAt: at(24), eventAt: at(24) }, T0);
    await pick(db, u.Bo, id, "yes", at(1));
    await pick(db, u.Ada, id, "no", at(1));
    await runDueCalls(db, at(24)); // Cem settles; prompt queued
    await proposeResult(db, u.Cem, id, "yes", at(24.1)); // settled before the email went out
    const mails: string[] = [];
    await deliverOutbox(db, async (_to, subject) => void mails.push(subject), at(24.2));
    expect(mails.some((m) => m.includes("Time to settle “Will the cake rise?”"))).toBe(false);
  });

  it("doesn't email people who turned email off or left, and expires old messages", async () => {
    const { u, outboxId } = await queued();
    await db.update(users).set({ emailAlerts: false }).where(eq(users.id, u.Dee.id));
    await deliverOutbox(db, async () => {}, at(0.1));
    expect((await status(outboxId)).status).toBe("expired");

    const again = await queued();
    await leaveGroup(db, again.u.Dee, again.groupId, at(0.05));
    await deliverOutbox(db, async () => {}, at(0.1));
    expect((await status(again.outboxId)).status).toBe("expired");

    const late = await queued();
    await deliverOutbox(db, async () => {}, at(25));
    expect((await status(late.outboxId)).status).toBe("expired");
  });
});
