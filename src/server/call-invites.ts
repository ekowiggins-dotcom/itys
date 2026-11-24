/**
 * Invites through a call. A member shares an open call (to WhatsApp, say); a friend who opens the link sees the
 * call and who has already picked (never what), taps their pick, signs in, and joins the group with that pick in.
 *
 * Rules (decided in visibility.ts, checked again on every view and every join):
 * - Only an open, visible call, shared by a current member. A call about a person only by that person.
 * - The link shows the group's name and size, the call, its options and the names of who has picked. Nothing else.
 * - Joining goes through groups.addMember, so bans, the size cap and name clashes work as for the group invite.
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { User } from "./auth";
import { nameSchema } from "./auth";
import { randomToken } from "./crypto";
import { callInvites, calls, groups, members, picks, type CallOption } from "./db/schema";
import type { Db, Tx } from "./db/types";
import { AppError, notFound } from "./errors";
import { addMember, MAX_MEMBERS, requireMember } from "./groups";
import { hit, LIMITS } from "./rate-limit";
import { callInviteAllowed, callVisibility } from "./visibility";
import { faceColors, GROUP_COLORS, groupColorKey } from "@/lib/faces";

const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/** Makes (or returns) this member's invite link for an open call. One link per person per call. */
export async function createCallInvite(db: Db, user: User, callId: string, now = new Date()) {
  if (!z.uuid().safeParse(callId).success) throw notFound("Call");
  const [c] = await db.select().from(calls).where(eq(calls.id, callId));
  if (!c) throw notFound("Call");
  await requireMember(db, user, c.groupId);
  if (!callVisibility(c, { userId: user.id, isMember: true }, now).canInvite) {
    throw new AppError(
      "forbidden",
      c.subjectId && c.subjectId !== user.id
        ? "Only the person this call is about can share it outside the group."
        : "You can invite with a call only while picks are open.",
    );
  }
  const where = and(eq(callInvites.callId, callId), eq(callInvites.createdBy, user.id));
  const [existing] = await db.select({ token: callInvites.token }).from(callInvites).where(where);
  if (existing) return existing.token;
  await db.insert(callInvites).values({ token: randomToken(16), callId, createdBy: user.id, createdAt: now }).onConflictDoNothing();
  const [row] = await db.select({ token: callInvites.token }).from(callInvites).where(where);
  return row.token;
}

export type CallInvitePreview = {
  groupId: string;
  groupName: string;
  /** The group's colour (hex). */
  color: string;
  memberCount: number;
  full: boolean;
  sharerName: string;
  text: string;
  kind: "yes_no" | "choice" | "member";
  /** For "who" calls the labels are the members' current names. */
  options: CallOption[];
  /** Face colour per option key ("who" calls only). */
  faces: Record<string, string>;
  lockAt: Date;
  /** Names of members who have picked, first pick first. Never what they picked. */
  pickers: string[];
  /** The viewer is already in the group (send them straight to it). */
  alreadyMember: boolean;
  /** The viewer is the person the call is about, so they can join but not pick. */
  isAboutViewer: boolean;
};

/** Loads an invite and its call, or null if the link doesn't (or no longer) work. */
async function load(db: Db | Tx, token: string, now: Date, lock = false) {
  if (!TOKEN.test(token)) return null;
  const [invite] = await db.select().from(callInvites).where(eq(callInvites.token, token));
  if (!invite) return null;
  const q = db.select().from(calls).where(eq(calls.id, invite.callId));
  const [c] = lock ? await q.for("update") : await q;
  if (!c) return null;
  const [sharer] = await db
    .select({ name: members.displayName })
    .from(members)
    .where(and(eq(members.groupId, c.groupId), eq(members.userId, invite.createdBy), isNull(members.leftAt)));
  if (!callInviteAllowed({ ...c, sharedBy: invite.createdBy, sharerIsMember: !!sharer }, now)) return null;
  return { call: c, sharerName: sharer!.name };
}

/** What the invite link shows. Null when it shouldn't show anything (any more). Rate-limited per IP. */
export async function callInvitePreview(
  db: Db,
  token: string,
  ip: string | null,
  user: User | null,
  now = new Date(),
): Promise<CallInvitePreview | null> {
  if (ip) await hit(db, LIMITS.callInviteViewByIp, ip, now);
  const found = await load(db, token, now);
  if (!found) return null;
  const { call: c, sharerName } = found;
  const [group] = await db.select().from(groups).where(eq(groups.id, c.groupId));
  const active = await db
    .select({ userId: members.userId, displayName: members.displayName })
    .from(members)
    .where(and(eq(members.groupId, c.groupId), isNull(members.leftAt)))
    .orderBy(asc(members.joinedAt));
  const nameOf = new Map(active.map((m) => [m.userId, m.displayName]));
  const pickRows = await db
    .select({ userId: picks.userId })
    .from(picks)
    .where(eq(picks.callId, c.id))
    .orderBy(asc(picks.updatedAt));
  const colorKey = groupColorKey(group.color, group.id);
  const allFaces = faceColors(
    active.map((m) => m.userId),
    colorKey,
  );
  const options =
    c.kind === "member"
      ? c.options.filter((o) => nameOf.has(o.key)).map((o) => ({ key: o.key, label: nameOf.get(o.key)! }))
      : c.options;
  return {
    groupId: group.id,
    groupName: group.name,
    color: GROUP_COLORS[colorKey],
    memberCount: active.length,
    full: active.length >= MAX_MEMBERS,
    sharerName,
    text: c.text,
    kind: c.kind,
    options,
    faces: c.kind === "member" ? Object.fromEntries(options.map((o) => [o.key, allFaces[o.key]])) : {},
    lockAt: c.lockAt,
    pickers: pickRows.map((p) => nameOf.get(p.userId)).filter((n): n is string => !!n),
    alreadyMember: !!user && nameOf.has(user.id),
    isAboutViewer: !!user && c.subjectId === user.id,
  };
}

/**
 * Joins the call's group through the invite and, if `optionKey` is given, makes that pick, in one transaction.
 * Returns the group id.
 */
export async function joinWithCallInvite(
  db: Db,
  user: User,
  token: string,
  rawDisplayName: string,
  optionKey: string | null,
  ip: string,
  now = new Date(),
) {
  const displayName = nameSchema.parse(rawDisplayName);
  await hit(db, LIMITS.joinByIp, ip, now);
  return db.transaction(async (tx) => {
    const found = await load(tx, token, now, true);
    if (!found) throw new AppError("invalid", "This invite has closed. Ask your friend for the group's invite link.");
    const { call: c } = found;
    // Lock the group, as joinGroup does, so two joins can't both take the last place.
    await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, c.groupId)).for("update");
    await addMember(tx, c.groupId, user, displayName, now);
    if (optionKey) {
      if (!c.options.some((o) => o.key === optionKey)) throw new AppError("invalid", "That isn't one of the options.");
      if (callVisibility(c, { userId: user.id, isMember: true }, now).canPick) {
        await tx
          .insert(picks)
          .values({ callId: c.id, userId: user.id, optionKey, updatedAt: now })
          .onConflictDoUpdate({ target: [picks.callId, picks.userId], set: { optionKey, updatedAt: now } });
      }
    }
    return c.groupId;
  });
}
