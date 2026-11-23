/**
 * Creating notifications. Always called inside the transaction that changes state, so an event and its
 * notifications are saved together or not at all (transactional outbox). Each event notifies a user once
 * (dedupe key). Only "needs you" events also go out by email, and only to people who keep email alerts on.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { members, notifications, outbox, users, type NotificationType } from "./db/schema";
import type { Tx } from "./db/types";

/** Events worth an email: someone needs to act, or a call is about them. */
export const EMAIL_TYPES: NotificationType[] = ["about_you", "settle_prompt", "vote_needed"];

export type Emit = {
  type: NotificationType;
  groupId: string;
  callId?: string | null;
  actorId?: string | null;
  userIds: string[];
  now: Date;
};

export async function emit(tx: Tx, e: Emit) {
  // Never notify people who have left, or the person who caused the event.
  const ids = [...new Set(e.userIds)].filter((id) => id !== e.actorId);
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

  if (!EMAIL_TYPES.includes(e.type)) return;
  const wantsEmail = new Set(active.filter((a) => a.emailAlerts).map((a) => a.userId));
  const rows = inserted.filter((n) => wantsEmail.has(n.userId));
  if (rows.length) {
    await tx
      .insert(outbox)
      .values(rows.map((n) => ({ notificationId: n.id, channel: "email", nextTryAt: e.now, createdAt: e.now })))
      .onConflictDoNothing();
  }
}

/** Active members of a group, optionally without some people. */
export async function groupMemberIds(tx: Tx, groupId: string, except: (string | null | undefined)[] = []) {
  const rows = await tx
    .select({ userId: members.userId })
    .from(members)
    .where(and(eq(members.groupId, groupId), isNull(members.leftAt)));
  return rows.map((r) => r.userId).filter((id) => !except.includes(id));
}
