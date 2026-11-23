/**
 * Creating notifications. Always called inside the transaction that changes state, so an event and its
 * notifications are saved together or not at all (transactional outbox). Each event notifies a user once
 * (dedupe key). Only "needs you" events also go out by email, and only to people who keep email alerts on.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { blocks, devices, members, notifications, outbox, users, type NotificationType } from "./db/schema";
import type { Tx } from "./db/types";
import { apnsConfigured } from "./apns";

/** Events worth an email: someone needs to act, or a call is about them. */
export const EMAIL_TYPES: NotificationType[] = ["about_you", "settle_prompt", "vote_needed", "review_needed"];
/** Events worth a push on the phone (the app's core loop). Joins and removals stay in the app. */
export const PUSH_TYPES: NotificationType[] = [
  "call_created",
  "about_you",
  "lock_reminder",
  "settle_prompt",
  "result_proposed",
  "vote_needed",
  "settled",
  "called_off",
  "review_needed",
];

export type Emit = {
  type: NotificationType;
  groupId: string;
  callId?: string | null;
  actorId?: string | null;
  userIds: (string | null | undefined)[];
  now: Date;
};

export async function emit(tx: Tx, e: Emit) {
  // Never notify people who have left, or the person who caused the event.
  let ids = [...new Set(e.userIds)].filter((id): id is string => !!id && id !== e.actorId);
  // People who blocked the actor don't hear from them.
  if (e.actorId && ids.length) {
    const blockers = await tx
      .select({ id: blocks.blockerId })
      .from(blocks)
      .where(and(eq(blocks.blockedId, e.actorId), inArray(blocks.blockerId, ids)));
    const muted = new Set(blockers.map((b) => b.id));
    ids = ids.filter((id) => !muted.has(id));
  }
  if (ids.length === 0) return;
  const active = await tx
    .select({ userId: members.userId, emailAlerts: users.emailAlerts })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.groupId, e.groupId), isNull(members.leftAt), inArray(members.userId, ids)));
  if (active.length === 0) return;

  const dedupeKey = `${e.type}:${e.callId ?? e.actorId ?? ""}`;
  const inserted = await tx
    .insert(notifications)
    .values(
      active.map((a) => ({
        userId: a.userId,
        groupId: e.groupId,
        callId: e.callId ?? null,
        actorId: e.actorId ?? null,
        type: e.type,
        dedupeKey,
        createdAt: e.now,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: notifications.id, userId: notifications.userId });

  const queue: { notificationId: string; channel: string; nextTryAt: Date; createdAt: Date }[] = [];
  if (EMAIL_TYPES.includes(e.type)) {
    const wantsEmail = new Set(active.filter((a) => a.emailAlerts).map((a) => a.userId));
    for (const n of inserted) if (wantsEmail.has(n.userId)) queue.push({ notificationId: n.id, channel: "email", nextTryAt: e.now, createdAt: e.now });
  }
  // In production, pushes are only queued once APNs is configured (otherwise they'd just fail and retry).
  const canPush = apnsConfigured() || process.env.NODE_ENV !== "production";
  if (canPush && PUSH_TYPES.includes(e.type) && inserted.length) {
    const withPhone = await tx
      .selectDistinct({ userId: devices.userId })
      .from(devices)
      .where(and(isNull(devices.disabledAt), inArray(devices.userId, inserted.map((n) => n.userId))));
    const has = new Set(withPhone.map((d) => d.userId));
    for (const n of inserted) if (has.has(n.userId)) queue.push({ notificationId: n.id, channel: "push", nextTryAt: e.now, createdAt: e.now });
  }
  if (queue.length) await tx.insert(outbox).values(queue).onConflictDoNothing();
}

/** Active members of a group, optionally without some people. */
export async function groupMemberIds(tx: Tx, groupId: string, except: (string | null | undefined)[] = []) {
  const rows = await tx
    .select({ userId: members.userId })
    .from(members)
    .where(and(eq(members.groupId, groupId), isNull(members.leftAt)));
  return rows.map((r) => r.userId).filter((id) => !except.includes(id));
}
