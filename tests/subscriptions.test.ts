import { readFileSync } from "node:fs";
import { createPrivateKey, sign, X509Certificate } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { User } from "@/server/auth";
import { callInvitePreview, createCallInvite, joinWithCallInvite } from "@/server/call-invites";
import { createCall, pick } from "@/server/calls";
import { groups, subscriptions } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createGroup, groupForMember, invitePreview, joinGroup, leaveGroup } from "@/server/groups";
import { verifyAppStoreJws, type TransactionPayload } from "@/server/storekit";
import { groupPlan, handleNotification, hasPro, proStatus, syncFromApp } from "@/server/subscriptions";
import { signUp, testDb } from "./helpers";

// A test certificate chain shaped like Apple's: root → intermediate (WWDR marker) → leaf (receipt-signing marker).
const fx = (f: string) => readFileSync(`tests/fixtures/storekit/${f}`, "utf8");
const root = new X509Certificate(fx("root.pem"));
const der = (pem: string) => new X509Certificate(pem).raw.toString("base64");
const CHAIN = [der(fx("leaf.pem")), der(fx("inter.pem")), der(fx("root.pem"))];
const LEAF_KEY = createPrivateKey(fx("leaf.key"));
const opts = { roots: [root] };

function jws(payload: object, { chain = CHAIN, key = LEAF_KEY } = {}) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = `${b64({ alg: "ES256", x5c: chain })}.${b64(payload)}`;
  return `${head}.${sign("sha256", Buffer.from(head), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

const T0 = new Date("2026-12-01T09:00:00Z");
const DAY = 86400_000;
const at = (d: number) => new Date(T0.getTime() + d * DAY);
let n = 0;
const ip = () => `10.7.${Math.floor(++n / 250)}.${n % 250}`;

let txN = 0;
function transaction(user: User | null, o: Partial<TransactionPayload> & { original?: string } = {}): TransactionPayload {
  const id = `${2000000000 + ++txN}`;
  return {
    transactionId: id,
    originalTransactionId: o.original ?? id,
    bundleId: "app.wholl.ios",
    productId: "app.wholl.ios.pro.monthly",
    type: "Auto-Renewable Subscription",
    purchaseDate: T0.getTime(),
    expiresDate: at(30).getTime(),
    environment: "Sandbox",
    signedDate: T0.getTime(),
    ...(user ? { appAccountToken: user.id } : {}),
    ...o,
  };
}
const notification = (type: string, t: TransactionPayload, renewal?: object, subtype?: string) =>
  jws({
    notificationType: type,
    subtype,
    notificationUUID: crypto.randomUUID(),
    signedDate: t.signedDate,
    data: {
      bundleId: "app.wholl.ios",
      environment: "Sandbox",
      signedTransactionInfo: jws(t),
      ...(renewal ? { signedRenewalInfo: jws({ originalTransactionId: t.originalTransactionId, signedDate: t.signedDate, ...renewal }) } : {}),
    },
  });

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("App Store signatures", () => {
  it("accepts data signed by a chain that ends in a trusted root", () => {
    const t = transaction(null);
    expect(verifyAppStoreJws<TransactionPayload>(jws(t), opts).transactionId).toBe(t.transactionId);
  });

  it("rejects anything not from Apple: other roots, tampering, missing markers, short chains", () => {
    const t = transaction(null);
    // Apple's real root is the default: the test chain isn't trusted.
    expect(() => verifyAppStoreJws(jws(t))).toThrow(/couldn.t be verified/);
    // Payload changed after signing.
    const [h, , s] = jws(t).split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...t, expiresDate: at(999).getTime() })).toString("base64url")}.${s}`;
    expect(() => verifyAppStoreJws(forged, opts)).toThrow();
    // A leaf without the App Store receipt-signing marker (same intermediate).
    const plain = jws(t, { chain: [der(fx("plain.pem")), CHAIN[1], CHAIN[2]], key: createPrivateKey(fx("plain.key")) });
    expect(() => verifyAppStoreJws(plain, opts)).toThrow();
    // Signed by a key that isn't the leaf's.
    expect(() => verifyAppStoreJws(jws(t, { key: createPrivateKey(fx("plain.key")) }), opts)).toThrow();
    // The leaf presented as its own issuer.
    expect(() => verifyAppStoreJws(jws(t, { chain: [CHAIN[0], CHAIN[0], CHAIN[2]] }), opts)).toThrow();
    expect(() => verifyAppStoreJws(jws(t, { chain: [CHAIN[0], CHAIN[2]] }), opts)).toThrow();
    expect(() => verifyAppStoreJws("not.a.jws", opts)).toThrow();
  });
});

describe("buying and restoring in the app", () => {
  it("links a purchase to the buyer and turns Pro on until the period ends", async () => {
    const { user } = await signUp(db, "Buyer");
    expect(await hasPro(db, user.id, T0)).toBe(false);
    const status = await syncFromApp(db, user, { transactions: [jws(transaction(user, { offerType: 1 }))] }, T0, opts);
    expect(status).toMatchObject({ active: true, productId: "app.wholl.ios.pro.monthly", inTrial: true, autoRenew: true });
    expect(await hasPro(db, user.id, at(29))).toBe(true);
    expect(await hasPro(db, user.id, at(31))).toBe(false);
  });

  it("refuses other apps' purchases and other products", async () => {
    const { user } = await signUp(db, "Other");
    await expect(syncFromApp(db, user, { transactions: [jws(transaction(user, { bundleId: "com.example" }))] }, T0, opts)).rejects.toThrow(
      /different app/,
    );
    await expect(syncFromApp(db, user, { transactions: [jws(transaction(user, { productId: "coins" }))] }, T0, opts)).rejects.toThrow(
      /isn.t a Who.ll Pro/,
    );
  });

  it("keeps another account's purchase theirs, unless this account restores it", async () => {
    const a = (await signUp(db, "PhoneA")).user;
    const b = (await signUp(db, "PhoneB")).user;
    const signed = jws(transaction(a));
    await syncFromApp(db, a, { transactions: [signed] }, T0, opts);
    // B signs in on the same phone: the app's start-up sync doesn't move A's subscription.
    expect((await syncFromApp(db, b, { transactions: [signed] }, at(1), opts)).active).toBe(false);
    expect(await hasPro(db, a.id, at(1))).toBe(true);
    // "Restore purchases" does.
    expect((await syncFromApp(db, b, { transactions: [signed], restore: true }, at(1), opts)).active).toBe(true);
    expect(await hasPro(db, a.id, at(1))).toBe(false);
  });

  it("records a cancelled auto-renew from the renewal info", async () => {
    const { user } = await signUp(db, "Canceller");
    const t = transaction(user);
    const renewal = jws({ originalTransactionId: t.originalTransactionId, autoRenewStatus: 0, signedDate: T0.getTime() });
    const s = await syncFromApp(db, user, { transactions: [jws(t)], renewals: [renewal] }, T0, opts);
    expect(s).toMatchObject({ active: true, autoRenew: false });
  });
});

describe("App Store Server Notifications", () => {
  it("renews, keeps Pro through a billing grace period, and expires", async () => {
    const { user } = await signUp(db, "Renewer");
    const first = transaction(user);
    await handleNotification(db, notification("SUBSCRIBED", first, { autoRenewStatus: 1 }, "INITIAL_BUY"), T0, opts);
    expect(await hasPro(db, user.id, T0)).toBe(true); // linked by appAccountToken before the app synced

    const renewed = transaction(user, { original: first.originalTransactionId, purchaseDate: at(30).getTime(), expiresDate: at(60).getTime(), signedDate: at(30).getTime() });
    await handleNotification(db, notification("DID_RENEW", renewed, { autoRenewStatus: 1 }), at(30), opts);
    expect(await hasPro(db, user.id, at(45))).toBe(true);

    // The older renewal arriving late changes nothing.
    await handleNotification(db, notification("DID_RENEW", first), at(45), opts);
    expect((await proStatus(db, user.id, at(45))).expiresAt).toEqual(at(60));

    // Payment fails at the end of the period: Apple retries, Pro stays on for the grace period.
    await handleNotification(
      db,
      notification("DID_FAIL_TO_RENEW", renewed, { autoRenewStatus: 1, gracePeriodExpiresDate: at(66).getTime() }, "GRACE_PERIOD"),
      at(60),
      opts,
    );
    expect(await proStatus(db, user.id, at(62))).toMatchObject({ active: true, graceUntil: at(66) });
    expect(await hasPro(db, user.id, at(67))).toBe(false);
  });

  it("turns Pro off at once on a refund, and back on if the refund is reversed", async () => {
    const { user } = await signUp(db, "Refunded");
    const t = transaction(user);
    await syncFromApp(db, user, { transactions: [jws(t)] }, T0, opts);
    await handleNotification(db, notification("REFUND", { ...t, revocationDate: at(3).getTime(), signedDate: at(3).getTime() }), at(3), opts);
    expect(await proStatus(db, user.id, at(3))).toMatchObject({ active: false, revoked: true });
    await handleNotification(db, notification("REFUND_REVERSED", { ...t, signedDate: at(4).getTime() }), at(4), opts);
    expect(await hasPro(db, user.id, at(4))).toBe(true);
  });

  it("keeps a subscription nobody is linked to yet until the app syncs, and ignores test pings", async () => {
    const t = transaction(null);
    await handleNotification(db, notification("SUBSCRIBED", t), T0, opts);
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.originalTransactionId, t.originalTransactionId));
    expect(row.userId).toBeNull();
    const { user } = await signUp(db, "Later");
    expect((await syncFromApp(db, user, { transactions: [jws(t)] }, T0, opts)).active).toBe(true);
    const test = jws({ notificationType: "TEST", notificationUUID: crypto.randomUUID(), data: { bundleId: "app.wholl.ios" } });
    expect(await handleNotification(db, test, T0, opts)).toEqual({ type: "TEST", applied: false });
    await expect(handleNotification(db, "junk", T0, opts)).rejects.toThrow();
  });
});

describe("group size and paused groups", () => {
  /** Ada makes a group with Bo, Cem and Dee (4 people: the free size). Eve and Fay aren't in it. */
  async function four() {
    const u: Record<string, User> = {};
    for (const name of ["Ada", "Bo", "Cem", "Dee", "Eve", "Fay"]) u[name] = (await signUp(db, name)).user;
    const groupId = await createGroup(db, u.Ada, { name: "Four", timeZone: "UTC", displayName: "Ada" }, T0);
    const invite = (await groupForMember(db, u.Ada, groupId, T0)).inviteToken!;
    for (const name of ["Bo", "Cem", "Dee"]) await joinGroup(db, u[name], invite, name, ip(), T0);
    return { u, groupId, invite };
  }
  const buy = (user: User, now: Date, expires: Date) =>
    syncFromApp(db, user, { transactions: [jws(transaction(user, { purchaseDate: now.getTime(), expiresDate: expires.getTime(), signedDate: now.getTime() }))] }, now, opts);
  const newCall = (user: User, groupId: string, now: Date) =>
    createCall(db, user, groupId, { text: "Will it snow this week?", kind: "yes_no", lockAt: new Date(now.getTime() + 2 * DAY), eventAt: new Date(now.getTime() + 3 * DAY) }, now);

  it("keeps a 5th person out of a free group, by group link and by call invite", async () => {
    const { u, groupId, invite } = await four();
    expect((await invitePreview(db, invite, ip(), null, T0))?.needsPro).toBe(true);
    await expect(joinGroup(db, u.Eve, invite, "Eve", ip(), T0)).rejects.toThrow(/Free groups have up to 4 people/);

    const callId = await newCall(u.Bo, groupId, T0);
    const token = await createCallInvite(db, u.Bo, callId, T0);
    expect((await callInvitePreview(db, token, null, null, T0))?.needsPro).toBe(true);
    await expect(joinWithCallInvite(db, u.Eve, token, "Eve", "yes", ip(), T0)).rejects.toThrow(/Free groups/);

    const view = await groupForMember(db, u.Bo, groupId, T0);
    expect(view.plan).toMatchObject({ memberCount: 4, limit: 4, payerName: "Ada", payerIsMe: false, frozen: false, canAddMember: false });
  });

  it("lets the group grow once its creator has Pro, whoever sends the invite", async () => {
    const { u, groupId, invite } = await four();
    await buy(u.Ada, T0, at(30));
    expect((await invitePreview(db, invite, ip(), null, T0))?.needsPro).toBe(false);
    await joinGroup(db, u.Eve, invite, "Eve", ip(), T0);
    const callId = await newCall(u.Cem, groupId, T0);
    await joinWithCallInvite(db, u.Fay, await createCallInvite(db, u.Cem, callId, T0), "Fay", "no", ip(), T0);
    expect((await groupPlan(db, groupId, T0)).memberCount).toBe(6);
  });

  it("pauses a 5+ group when the creator's Pro ends: open calls carry on, nothing new until they renew", async () => {
    const { u, groupId, invite } = await four();
    await buy(u.Ada, T0, at(30));
    await joinGroup(db, u.Eve, invite, "Eve", ip(), T0);
    const open = await newCall(u.Bo, groupId, at(29));

    const later = at(30.5);
    expect((await groupPlan(db, groupId, later)).frozen).toBe(true);
    await expect(newCall(u.Bo, groupId, later)).rejects.toThrow(/paused until Ada renews/);
    await expect(newCall(u.Ada, groupId, later)).rejects.toThrow(/Your Who.ll Pro has ended/);
    await expect(joinGroup(db, u.Fay, invite, "Fay", ip(), later)).rejects.toThrow(/paused/);
    await pick(db, u.Cem, open, "yes", later); // open calls still take picks
    expect((await groupForMember(db, u.Eve, groupId, later)).members).toHaveLength(5); // nobody removed

    await buy(u.Ada, at(32), at(62));
    expect((await groupPlan(db, groupId, at(32))).frozen).toBe(false);
    await newCall(u.Bo, groupId, at(32));
  });

  it("isn't paused once it's back to the free size", async () => {
    const { u, groupId, invite } = await four();
    await buy(u.Ada, T0, at(30));
    await joinGroup(db, u.Eve, invite, "Eve", ip(), T0);
    await leaveGroup(db, u.Eve, groupId, at(31));
    expect((await groupPlan(db, groupId, at(31))).frozen).toBe(false);
    await newCall(u.Bo, groupId, at(31));
  });

  it("lets groups made before Pro keep their size for free", async () => {
    const { u, groupId, invite } = await four();
    await db.update(groups).set({ freeMembers: 5 }).where(eq(groups.id, groupId));
    await joinGroup(db, u.Eve, invite, "Eve", ip(), T0);
    await expect(joinGroup(db, u.Fay, invite, "Fay", ip(), T0)).rejects.toThrow(/Free groups have up to 5 people/);
    await newCall(u.Eve, groupId, T0);
  });

  it("changes nothing while the switch is off, and lets groups that grew keep their size", async () => {
    const { u, groupId, invite } = await four();
    process.env.PRO_LIMITS = "off";
    try {
      expect((await invitePreview(db, invite, ip(), null, T0))?.needsPro).toBe(false);
      await joinGroup(db, u.Eve, invite, "Eve", ip(), T0);
      expect(await groupPlan(db, groupId, T0)).toMatchObject({ memberCount: 5, frozen: false, canAddMember: true, enforced: false });
    } finally {
      process.env.PRO_LIMITS = "on";
    }
    // Switched on later: not paused (it grew while free), but nobody else joins without Pro.
    expect(await groupPlan(db, groupId, T0)).toMatchObject({ freeMembers: 5, frozen: false, canAddMember: false });
    await newCall(u.Eve, groupId, T0);
    await expect(joinGroup(db, u.Fay, invite, "Fay", ip(), T0)).rejects.toThrow(/Free groups have up to 5 people/);
  });

  it("looks to the admin's Pro once the creator has left", async () => {
    const { u, groupId, invite } = await four();
    await leaveGroup(db, u.Ada, groupId, T0); // Bo becomes admin
    expect((await groupPlan(db, groupId, T0)).payerName).toBe("Bo");
    await buy(u.Bo, T0, at(30));
    await joinGroup(db, u.Eve, invite, "Eve", ip(), T0);
    await joinGroup(db, u.Fay, invite, "Fay", ip(), T0);
    expect((await groupPlan(db, groupId, T0)).memberCount).toBe(5);
  });
});
