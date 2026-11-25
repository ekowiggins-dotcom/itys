/**
 * Who'll Pro: bigger groups.
 *
 * - Groups of up to 4 active members are free (`groups.free_members`; groups made before Pro keep the size they
 *   had then). Beyond that, the group's payer needs Pro. The payer is the member who created the group, or the
 *   admin once the creator has left or deleted their account (so a group never depends on someone who's gone).
 * - One Pro subscription covers every group its owner pays for. Monthly or yearly, bought in the iOS app.
 * - If the payer's Pro ends while the group has more members than its free size, the group is paused ("frozen"):
 *   no new calls and no new members until they renew. Open calls carry on (picks, settling, disputes), nobody is
 *   removed and nothing is deleted.
 * - Points stay free: Pro only changes how many people a group can have.
 *
 * Subscriptions come from the App Store as signed data (see storekit.ts): the app sends StoreKit 2 transactions
 * after a purchase or restore, and Apple sends App Store Server Notifications v2 for renewals, expiry, billing
 * problems, refunds and revocation. The app sets `appAccountToken` to the buyer's user id, which links them.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { User } from "./auth";
import { groups, members, subscriptions, users } from "./db/schema";
import type { Db, Tx } from "./db/types";
import { AppError } from "./errors";
import {
  verifyAppStoreJws,
  type JwsOptions,
  type NotificationPayload,
  type RenewalPayload,
  type TransactionPayload,
} from "./storekit";

/** The most members a group can have, even with Pro (groups.MAX_MEMBERS). */
export const MAX_WITH_PRO = 20;
export const FREE_MEMBERS = 4;

/**
 * The switch: limits apply only with PRO_LIMITS=on. Until then groups have no free-size limit (up to 20, like Pro) and Pro shows only
 * in app builds that can buy it, so the 1.0 app (which can't) never meets a paywall. Turn it on once 1.1 is out.
 */
export const proLimitsOn = () => process.env.PRO_LIMITS === "on";

/** The Pro products, set in App Store Connect. */
export function proProductIds() {
  return (process.env.IAP_PRODUCT_IDS ?? "app.wholl.ios.pro.monthly,app.wholl.ios.pro.yearly")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
const bundleId = () => process.env.IOS_BUNDLE_ID ?? "app.wholl.ios";

export type ProStatus = {
  active: boolean;
  productId: string | null;
  /** End of the current period (or of the last one, if it has ended). */
  expiresAt: Date | null;
  autoRenew: boolean;
  inTrial: boolean;
  /** Apple is retrying a failed payment; Pro stays on until then. */
  graceUntil: Date | null;
  revoked: boolean;
};

const isActive = (s: typeof subscriptions.$inferSelect, now: Date) =>
  !s.revokedAt && Math.max(s.expiresAt.getTime(), s.graceUntil?.getTime() ?? 0) > now.getTime();

/** The person's Pro status: their active subscription if they have one, else the one that ended last. */
export async function proStatus(db: Db | Tx, userId: string, now = new Date()): Promise<ProStatus> {
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.expiresAt));
  const s = rows.find((r) => isActive(r, now)) ?? rows[0];
  if (!s) return { active: false, productId: null, expiresAt: null, autoRenew: false, inTrial: false, graceUntil: null, revoked: false };
  const inGrace = !!s.graceUntil && s.graceUntil > now && s.expiresAt <= now;
  return {
    active: isActive(s, now),
    productId: s.productId,
    expiresAt: s.expiresAt,
    autoRenew: s.autoRenew,
    inTrial: s.inTrial && s.expiresAt > now,
    graceUntil: inGrace ? s.graceUntil : null,
    revoked: !!s.revokedAt,
  };
}

export async function hasPro(db: Db | Tx, userId: string, now = new Date()) {
  return (await proStatus(db, userId, now)).active;
}

/** How big a group may get, who pays for it, and whether it's paused. */
export type GroupPlan = {
  memberCount: number;
  freeMembers: number;
  payerId: string | null;
  /** The payer's name in this group. */
  payerName: string | null;
  payerHasPro: boolean;
  /** The most active members allowed right now. */
  limit: number;
  /** More members than the free size and the payer has no Pro: no new calls or members. */
  frozen: boolean;
  canAddMember: boolean;
  /** Whether limits apply at all (PRO_LIMITS=on). */
  enforced: boolean;
};

export async function groupPlan(db: Db | Tx, groupId: string, now = new Date()): Promise<GroupPlan> {
  const [g] = await db
    .select({ freeMembers: groups.freeMembers, createdBy: groups.createdBy })
    .from(groups)
    .where(eq(groups.id, groupId));
  if (!g) throw new AppError("not_found", "Group doesn't exist or you don't have access.");
  const active = await db
    .select({ userId: members.userId, displayName: members.displayName, role: members.role })
    .from(members)
    .where(and(eq(members.groupId, groupId), isNull(members.leftAt)));
  const payer = active.find((m) => m.userId === g.createdBy) ?? active.find((m) => m.role === "admin") ?? null;
  const payerHasPro = payer ? await hasPro(db, payer.userId, now) : false;
  const freeMembers = Math.min(g.freeMembers, MAX_WITH_PRO);
  const enforced = proLimitsOn();
  const limit = payerHasPro || !enforced ? MAX_WITH_PRO : freeMembers;
  const frozen = enforced && active.length > freeMembers && !payerHasPro;
  return {
    memberCount: active.length,
    freeMembers,
    payerId: payer?.userId ?? null,
    payerName: payer?.displayName ?? null,
    payerHasPro,
    limit,
    frozen,
    canAddMember: !frozen && active.length < limit,
    enforced,
  };
}

/** Throws unless someone new may join. Used by groups.addMember (group invite links and call invites). */
export async function assertCanAddMember(tx: Tx, groupId: string, now: Date) {
  const plan = await groupPlan(tx, groupId, now);
  if (plan.canAddMember) {
    // While the switch is off, a group that grows past its free size keeps that size for free.
    if (!plan.enforced && !plan.payerHasPro && plan.memberCount + 1 > plan.freeMembers) {
      await tx.update(groups).set({ freeMembers: sql`GREATEST(${groups.freeMembers}, ${plan.memberCount + 1})` }).where(eq(groups.id, groupId));
    }
    return plan;
  }
  if (plan.payerHasPro) throw new AppError("conflict", `This group is full (${plan.limit} people).`);
  if (plan.frozen) {
    throw new AppError("conflict", "This group is paused until whoever made it renews Who’ll Pro, so nobody new can join for now.");
  }
  throw new AppError(
    "conflict",
    `Free groups have up to ${plan.freeMembers} people. Whoever made the group can make room for more with Who’ll Pro.`,
  );
}

/** Throws if the group is paused. Used before making a call. */
export async function assertNotFrozen(tx: Tx, user: User, groupId: string, now: Date) {
  const plan = await groupPlan(tx, groupId, now);
  if (!plan.frozen) return;
  if (plan.payerId === user.id) {
    throw new AppError("forbidden", "Your Who’ll Pro has ended, so this group is paused. Renew it in Settings to make new calls.");
  }
  throw new AppError("forbidden", `This group is paused until ${plan.payerName ?? "the admin"} renews Who’ll Pro. Open calls carry on as usual.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Keeping subscriptions up to date from signed App Store data

const uuid = z.uuid();

/** Applies one verified transaction (and renewal info, if any). Returns the subscription's owner. */
async function applyTransaction(
  tx: Tx,
  t: TransactionPayload,
  renewal: RenewalPayload | null,
  owner: { userId: string; force: boolean } | null,
  now: Date,
) {
  if (t.bundleId !== bundleId()) throw new AppError("invalid", "That purchase is for a different app.");
  if (!proProductIds().includes(t.productId) || t.type !== "Auto-Renewable Subscription" || !t.expiresDate) {
    throw new AppError("invalid", "That isn’t a Who’ll Pro subscription.");
  }
  if (renewal && renewal.originalTransactionId !== t.originalTransactionId) renewal = null;

  // The app puts the buyer's user id in appAccountToken. Trust it only if that account exists.
  let tokenUser: string | null = null;
  if (t.appAccountToken && uuid.safeParse(t.appAccountToken).success) {
    const [u] = await tx.select({ id: users.id }).from(users).where(eq(users.id, t.appAccountToken.toLowerCase()));
    tokenUser = u?.id ?? null;
  }

  const [existing] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.originalTransactionId, t.originalTransactionId))
    .for("update");

  // Who it belongs to: the signed-in person restoring or buying it, else whoever it was linked to, else the token's.
  let userId = existing?.userId ?? tokenUser;
  if (owner && (owner.force || !userId || userId === owner.userId || tokenUser === owner.userId)) userId = owner.userId;

  const period = {
    productId: t.productId,
    transactionId: t.transactionId,
    environment: t.environment,
    purchasedAt: new Date(t.purchaseDate),
    expiresAt: new Date(t.expiresDate),
    revokedAt: t.revocationDate ? new Date(t.revocationDate) : null,
    // offerType 1 = introductory offer; our only one is the free trial.
    inTrial: t.offerType === 1,
  };
  const renewalFields = renewal
    ? {
        autoRenew: renewal.autoRenewStatus !== 0,
        graceUntil: renewal.gracePeriodExpiresDate ? new Date(renewal.gracePeriodExpiresDate) : null,
      }
    : {};

  if (!existing) {
    await tx.insert(subscriptions).values({
      originalTransactionId: t.originalTransactionId,
      userId,
      ...period,
      ...renewalFields,
      updatedAt: now,
      createdAt: now,
    });
    return userId;
  }
  // Notifications can arrive out of order: only the latest period (or news about the same transaction) counts.
  const sameOrNewer = t.transactionId === existing.transactionId || period.expiresAt >= existing.expiresAt;
  await tx
    .update(subscriptions)
    .set({
      userId,
      ...(sameOrNewer ? period : {}),
      // A new period clears an old grace period unless the renewal info says otherwise.
      ...(sameOrNewer && period.expiresAt > existing.expiresAt ? { graceUntil: null } : {}),
      ...renewalFields,
      updatedAt: now,
    })
    .where(eq(subscriptions.originalTransactionId, t.originalTransactionId));
  return userId;
}

/**
 * Called by the app with StoreKit 2 signed transactions: after a purchase, when it starts (current entitlements
 * and updates), and on "Restore purchases". A restore moves the subscription to the signed-in account, so it
 * works after signing in with a different account on the same Apple ID. Returns the person's Pro status.
 */
export async function syncFromApp(
  db: Db,
  user: User,
  input: { transactions: string[]; renewals?: string[]; restore?: boolean },
  now = new Date(),
  opts: JwsOptions = {},
): Promise<ProStatus> {
  const list = z.array(z.string().max(20_000)).max(20).parse(input.transactions);
  const verified = list.map((jws) => verifyAppStoreJws<TransactionPayload>(jws, { now, ...opts }));
  const renewals = z
    .array(z.string().max(20_000))
    .max(20)
    .parse(input.renewals ?? [])
    .map((jws) => verifyAppStoreJws<RenewalPayload>(jws, { now, ...opts }));
  await db.transaction(async (tx) => {
    for (const t of verified) {
      const renewal = renewals.find((r) => r.originalTransactionId === t.originalTransactionId) ?? null;
      // A purchase made by another Who'll account on this phone stays theirs unless this is a restore.
      const theirs = t.appAccountToken && t.appAccountToken.toLowerCase() !== user.id && !input.restore;
      await applyTransaction(tx, t, renewal, theirs ? null : { userId: user.id, force: !!input.restore }, now);
    }
  });
  return proStatus(db, user.id, now);
}

/**
 * App Store Server Notifications v2 (POST /api/app-store/notifications). Every notification carries the latest
 * signed transaction and renewal info, so we just apply them: renewals (DID_RENEW, SUBSCRIBED), cancelling and
 * resuming auto-renew (DID_CHANGE_RENEWAL_STATUS), billing problems (DID_FAIL_TO_RENEW, GRACE_PERIOD_EXPIRED),
 * expiry (EXPIRED), refunds (REFUND, REFUND_REVERSED) and revocation (REVOKE, e.g. leaving Family Sharing).
 */
export async function handleNotification(db: Db, signedPayload: string, now = new Date(), opts: JwsOptions = {}) {
  const n = verifyAppStoreJws<NotificationPayload>(signedPayload, { now, ...opts });
  if (n.data?.bundleId && n.data.bundleId !== bundleId()) throw new AppError("invalid", "Wrong app.");
  const signedTx = n.data?.signedTransactionInfo;
  if (!signedTx) return { type: n.notificationType, applied: false };
  const t = verifyAppStoreJws<TransactionPayload>(signedTx, { now, ...opts });
  const renewal = n.data?.signedRenewalInfo ? verifyAppStoreJws<RenewalPayload>(n.data.signedRenewalInfo, { now, ...opts }) : null;
  if (!proProductIds().includes(t.productId)) return { type: n.notificationType, applied: false };
  await db.transaction((tx) => applyTransaction(tx, t, renewal, null, now));
  return { type: n.notificationType, applied: true };
}
