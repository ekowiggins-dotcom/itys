/**
 * Reading notifications. Text is rendered now, from current data, and only for groups the reader is still in.
 * Notifications never reveal anyone's pick: the only answers shown are a proposed or final result, which every
 * member can already see on the call.
 */
import { and, count, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import type { User } from "./auth";
import { calls, groups, members, notifications, scores, type NotificationType } from "./db/schema";
import type { Db } from "./db/types";

export type RenderedNotification = {
  id: string;
  type: NotificationType;
  text: string;
  href: string;
  groupName: string;
  createdAt: Date;
  read: boolean;
  /** False once the thing it asks for can't be done any more (e.g. the call was already settled). */
  stillNeeded: boolean;
};

type RenderInput = {
  type: NotificationType;
  actor: string;
  groupName: string;
  callText: string | null;
  /** The proposed answer (result_proposed) or final answer (settled), as a label. */
  answer: string | null;
  myPoints: number | null;
};

const q = (t: string | null) => (t ? `“${t}”` : "a call");

/** Pure text for one notification. Shared by the in-app list and emails. */
export function renderText(n: RenderInput): string {
  switch (n.type) {
    case "call_created":
      return `${n.actor} made a new call: ${q(n.callText)}`;
    case "about_you":
      return `${n.actor} made a call about you: ${q(n.callText)}`;
    case "lock_reminder":
      return `Picks close in 2 hours: ${q(n.callText)}`;
    case "settle_prompt":
      return `Time to settle ${q(n.callText)}. What happened?`;
    case "result_proposed":
      return `${n.actor} says ${q(n.answer)} for ${q(n.callText)}. You have 24 hours to dispute it.`;
    case "vote_needed":
      return `${n.actor} disputed the result of ${q(n.callText)}. Vote on what really happened.`;
    case "settled": {
      const pts = n.myPoints === null ? "" : n.myPoints > 0 ? ` +${n.myPoints} for you!` : "";
      return `Result for ${q(n.callText)}: ${n.answer ?? "settled"}.${pts}`;
    }
    case "called_off":
      return `${q(n.callText)} was called off. Nobody scores.`;
    case "member_joined":
      return `${n.actor} joined ${n.groupName}.`;
  }
}

/** Whether a "needs you" notification still asks for something that can be done. */
function stillNeeded(type: NotificationType, c: typeof calls.$inferSelect | undefined) {
  if (type === "settle_prompt") return c?.status === "active";
  if (type === "vote_needed") return c?.status === "disputed";
  if (type === "result_proposed") return c?.status === "proposed";
  if (type === "lock_reminder") return c?.status === "active" && Date.now() < c.lockAt.getTime();
  return c ? c.status !== "cancelled" : true;
}

export async function unreadCount(db: Db, user: User): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .innerJoin(
      members,
      and(eq(members.groupId, notifications.groupId), eq(members.userId, notifications.userId), isNull(members.leftAt)),
    )
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

/** Marks everything up to `upTo` as read (so items that arrive while reading stay unread). */
export async function markAllRead(db: Db, user: User, upTo: Date, now = new Date()) {
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt), lte(notifications.createdAt, upTo)));
}

/** Renders notifications by id for one user (used for the inbox and for emails). */
export async function renderNotifications(db: Db, userId: string, rows: (typeof notifications.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const groupIds = [...new Set(rows.map((r) => r.groupId))];
  const mine = await db
    .select({ groupId: members.groupId })
    .from(members)
    .where(and(eq(members.userId, userId), isNull(members.leftAt), inArray(members.groupId, groupIds)));
  const activeIn = new Set(mine.map((m) => m.groupId));
  const visible = rows.filter((r) => activeIn.has(r.groupId));
  if (visible.length === 0) return [];

  const groupRows = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(inArray(groups.id, [...activeIn]));
  const groupName = new Map(groupRows.map((g) => [g.id, g.name]));
  const nameRows = await db
    .select({ groupId: members.groupId, userId: members.userId, name: members.displayName })
    .from(members)
    .where(inArray(members.groupId, [...activeIn]));
  const nameOf = (groupId: string, id: string | null) =>
    nameRows.find((m) => m.groupId === groupId && m.userId === id)?.name ?? "Someone";

  const callIds = [...new Set(visible.map((r) => r.callId).filter((x): x is string => !!x))];
  const callRows = callIds.length ? await db.select().from(calls).where(inArray(calls.id, callIds)) : [];
  const callOf = new Map(callRows.map((c) => [c.id, c]));
  const scoreRows = callIds.length
    ? await db
        .select({ callId: scores.callId, points: scores.points })
        .from(scores)
        .where(and(eq(scores.userId, userId), inArray(scores.callId, callIds)))
    : [];
  const pointsOf = new Map(scoreRows.map((s) => [s.callId, s.points]));

  const label = (groupId: string, c: typeof calls.$inferSelect, key: string | null) => {
    if (!key) return null;
    if (key === "void") return "called off";
    if (c.kind === "member") return nameOf(groupId, key);
    return c.options.find((o) => o.key === key)?.label ?? null;
  };

  return visible.map((r): RenderedNotification => {
    const c = r.callId ? callOf.get(r.callId) : undefined;
    // Cancelled calls disappear from the group page, so their notifications show without the call's text.
    const shownCall = c && c.status !== "cancelled" ? c : undefined;
    const answer =
      shownCall && r.type === "result_proposed"
        ? label(r.groupId, shownCall, shownCall.proposedResult)
        : shownCall && r.type === "settled"
          ? label(r.groupId, shownCall, shownCall.result)
          : null;
    return {
      id: r.id,
      type: r.type,
      text: renderText({
        type: r.type,
        actor: nameOf(r.groupId, r.actorId),
        groupName: groupName.get(r.groupId) ?? "your group",
        callText: shownCall?.text ?? null,
        answer,
        myPoints: r.type === "settled" && c ? (pointsOf.get(c.id) ?? null) : null,
      }),
      href: `/groups/${r.groupId}${shownCall ? `#call-${shownCall.id}` : ""}`,
      groupName: groupName.get(r.groupId) ?? "",
      createdAt: r.createdAt,
      read: !!r.readAt,
      stillNeeded: stillNeeded(r.type, c),
    };
  });
}

export async function inbox(db: Db, user: User, limit = 50) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return renderNotifications(db, user.id, rows);
}
