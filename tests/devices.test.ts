import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { deleteAccount } from "@/server/account";
import type { PushPayload, PushResult } from "@/server/apns";
import { logout, logoutEverywhere, type User } from "@/server/auth";
import { createCall, pick } from "@/server/calls";
import { devices, notifications, outbox } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { deliverOutbox } from "@/server/delivery";
import { createWidgetToken, registerDevice, widgetSummary } from "@/server/devices";
import { createGroup, groupForMember, joinGroup } from "@/server/groups";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const T0 = new Date("2026-12-07T09:00:00Z");
const H = 3600_000;
const at = (h: number) => new Date(T0.getTime() + h * H);
const phone = (n: number) => n.toString(16).padStart(64, "a");
let ip = 0;
let tok = 0;

async function group() {
  const u: Record<string, User> = {};
  const s: Record<string, string> = {};
  for (const name of ["Ada", "Bo", "Cem"]) {
    const r = await signUp(db, name);
    u[name] = r.user;
    s[name] = r.sessionToken;
  }
  const groupId = await createGroup(db, u.Ada, { name: "Phones", timeZone: "UTC", displayName: "Ada" }, T0);
  const invite = (await groupForMember(db, u.Ada, groupId)).inviteToken!;
  for (const name of ["Bo", "Cem"]) await joinGroup(db, u[name], invite, name, `8.8.4.${++ip}`, T0);
  return { u, s, groupId };
}

const pushRows = async (userId: string) =>
  db
    .select({ id: outbox.id, status: outbox.status, type: notifications.type })
    .from(outbox)
    .innerJoin(notifications, eq(notifications.id, outbox.notificationId))
    .where(eq(notifications.userId, userId));

describe("registering phones", () => {
  it("rejects junk tokens and ties a phone to the session that registered it", async () => {
    const { u, s } = await group();
    await expect(registerDevice(db, u.Bo, s.Bo, "not-a-token")).rejects.toThrow(/push token/);
    const t = phone(++tok);
    await registerDevice(db, u.Bo, s.Bo, t);
    expect((await db.select().from(devices).where(eq(devices.token, t))).length).toBe(1);
    await logout(db, s.Bo); // signing out stops pushes to that phone
    expect(await db.select().from(devices).where(eq(devices.token, t))).toEqual([]);
  });

  it("moves a phone to whoever signs in on it next", async () => {
    const { u, s } = await group();
    const t = phone(++tok);
    await registerDevice(db, u.Bo, s.Bo, t);
    await registerDevice(db, u.Cem, s.Cem, t);
    const [row] = await db.select().from(devices).where(eq(devices.token, t));
    expect(row.userId).toBe(u.Cem.id);
  });
});

describe("push delivery", () => {
  it("queues pushes only for people with a phone, and only for core events", async () => {
    const { u, s, groupId } = await group();
    await registerDevice(db, u.Bo, s.Bo, phone(++tok));
    await createCall(db, u.Ada, groupId, { text: "Will the cake be ready?", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, T0);
    expect((await pushRows(u.Bo.id)).map((r) => r.type)).toContain("call_created");
    expect(await pushRows(u.Cem.id)).toEqual([]); // no phone
  });

  it("sends with title, text, link and badge; disables gone phones; learns the environment", async () => {
    const { u, s, groupId } = await group();
    const good = phone(++tok);
    const dead = phone(++tok);
    await registerDevice(db, u.Bo, s.Bo, good);
    await registerDevice(db, u.Bo, s.Bo, dead);
    await createCall(db, u.Ada, groupId, { text: "Will the train be on time?", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, T0);

    const sent: PushPayload[] = [];
    const push = async (ds: { token: string }[], p: PushPayload): Promise<PushResult[]> => {
      sent.push(p);
      return ds.map((d) => (d.token === dead ? { token: d.token, ok: false, gone: true } : { token: d.token, ok: true, environment: "sandbox" as const }));
    };
    await deliverOutbox(db, { email: async () => {}, push }, at(0.1));
    const mine = sent.find((p) => p.body.includes("train"))!;
    expect(mine).toMatchObject({ title: "Phones", body: "Ada made a new call: “Will the train be on time?”" });
    expect(mine.href).toMatch(/^\/groups\/.+#call-/);
    expect(mine.badge).toBeGreaterThan(0);
    const rows = await db.select().from(devices).where(eq(devices.userId, u.Bo.id));
    expect(rows.find((d) => d.token === dead)?.disabledAt).not.toBeNull();
    expect(rows.find((d) => d.token === good)?.environment).toBe("sandbox");
  });

  it("retries when no phone got it for a temporary reason", async () => {
    const { u, s, groupId } = await group();
    await registerDevice(db, u.Cem, s.Cem, phone(++tok));
    await createCall(db, u.Ada, groupId, { text: "Will the lights go out?", kind: "yes_no", lockAt: at(24), eventAt: at(48) }, T0);
    const down = async (ds: { token: string }[]) => ds.map((d) => ({ token: d.token, ok: false, error: "503" }));
    await deliverOutbox(db, { email: async () => {}, push: down }, at(0.1));
    const row = (await pushRows(u.Cem.id)).find((r) => r.type === "call_created")!;
    expect(row.status).toBe("queued");
  });
});

describe("the widget", () => {
  it("counts what needs you and open calls you haven't picked, with the next closing time", async () => {
    const { u, groupId } = await group();
    const soon = await createCall(db, u.Ada, groupId, { text: "Will Bo text back?", kind: "yes_no", lockAt: at(5), eventAt: at(6) }, T0);
    await createCall(db, u.Ada, groupId, { text: "Will it snow at Christmas?", kind: "yes_no", lockAt: at(30), eventAt: at(40) }, T0);
    const token = await createWidgetToken(db, u.Bo, T0);
    expect(await widgetSummary(db, token, at(1))).toEqual({ needsYou: 0, openCalls: 2, nextLockAt: at(5).toISOString() });
    await pick(db, u.Bo, soon, "yes", at(2));
    expect(await widgetSummary(db, token, at(2))).toMatchObject({ openCalls: 1, nextLockAt: at(30).toISOString() });
  });

  it("refuses unknown and revoked tokens", async () => {
    const { u } = await group();
    expect(await widgetSummary(db, "nope", T0)).toBeNull();
    expect(await widgetSummary(db, null, T0)).toBeNull();
    const old = await createWidgetToken(db, u.Bo, T0);
    const fresh = await createWidgetToken(db, u.Bo, T0);
    expect(await widgetSummary(db, old, T0)).toBeNull(); // replaced
    await logoutEverywhere(db, u.Bo);
    expect(await widgetSummary(db, fresh, T0)).toBeNull();
    const again = await createWidgetToken(db, u.Cem, T0);
    await deleteAccount(db, u.Cem, T0);
    expect(await widgetSummary(db, again, T0)).toBeNull();
  });
});
