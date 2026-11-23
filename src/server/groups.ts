import { and, asc, count, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { User } from "./auth";
import { nameSchema } from "./auth";
import { randomToken } from "./crypto";
import { groups, members } from "./db/schema";
import type { Db, Tx } from "./db/types";
import { AppError, notFound } from "./errors";
import { emit, groupMemberIds } from "./notify";
import { hit, LIMITS } from "./rate-limit";

export const MAX_MEMBERS = 30;
/** 16 bytes = 128 bits: invite links can't be guessed. */
const newInviteToken = () => randomToken(16);

const groupNameSchema = z.string().trim().min(2, "Give the group a name.").max(40, "Keep it to 40 characters.");
const timeZoneSchema = z.string().refine(isTimeZone, "Unknown time zone.");
const uuidSchema = z.uuid();

export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** What a member sees about a group. The invite link is included only for admins. */
export type GroupView = {
  id: string;
  name: string;
  timeZone: string;
  me: { displayName: string; role: "admin" | "member" };
  members: { userId: string; displayName: string; role: "admin" | "member"; joinedAt: Date }[];
  inviteToken: string | null;
};

export async function createGroup(
  db: Db,
  user: User,
  input: { name: string; timeZone: string; displayName: string },
  now = new Date(),
) {
  const name = groupNameSchema.parse(input.name);
  const timeZone = timeZoneSchema.parse(input.timeZone);
  const displayName = nameSchema.parse(input.displayName);
  await hit(db, LIMITS.createGroup, user.id, now);
  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({ name, timeZone, inviteToken: newInviteToken(), createdBy: user.id, createdAt: now })
      .returning({ id: groups.id });
    await tx.insert(members).values({ groupId: group.id, userId: user.id, displayName, role: "admin", joinedAt: now });
    return group.id;
  });
}

/** The groups the user is an active member of, newest first. */
export async function myGroups(db: Db, user: User) {
  const memberCount = db
    .select({ groupId: members.groupId, n: count().as("n") })
    .from(members)
    .where(isNull(members.leftAt))
    .groupBy(members.groupId)
    .as("member_count");
  return db
    .select({
      id: groups.id,
      name: groups.name,
      role: members.role,
      memberCount: memberCount.n,
    })
    .from(members)
    .innerJoin(groups, eq(groups.id, members.groupId))
    .innerJoin(memberCount, eq(memberCount.groupId, groups.id))
    .where(and(eq(members.userId, user.id), isNull(members.leftAt)))
    .orderBy(sql`${members.joinedAt} DESC`);
}

/** Returns the active membership or throws "not found" (never reveals that a group exists to outsiders). */
export async function requireMember(db: Db | Tx, user: User, groupId: string) {
  if (!uuidSchema.safeParse(groupId).success) throw notFound("Group");
  const [m] = await db
    .select()
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.userId, user.id), isNull(members.leftAt)));
  if (!m) throw notFound("Group");
  return m;
}

async function requireAdmin(db: Db | Tx, user: User, groupId: string) {
  const m = await requireMember(db, user, groupId);
  if (m.role !== "admin") throw new AppError("forbidden", "Only the group admin can do that.");
  return m;
}

export async function groupForMember(db: Db, user: User, groupId: string): Promise<GroupView> {
  const me = await requireMember(db, user, groupId);
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
  const list = await db
    .select({ userId: members.userId, displayName: members.displayName, role: members.role, joinedAt: members.joinedAt })
    .from(members)
    .where(and(eq(members.groupId, groupId), isNull(members.leftAt)))
    .orderBy(asc(members.joinedAt));
  return {
    id: group.id,
    name: group.name,
    timeZone: group.timeZone,
    me: { displayName: me.displayName, role: me.role },
    members: list,
    inviteToken: me.role === "admin" ? group.inviteToken : null,
  };
}

/**
 * What someone holding an invite link may see before joining: the group's name and size only.
 * Rate-limited per IP so invite tokens can't be brute-forced.
 */
export async function invitePreview(db: Db, token: string, ip: string, user: User | null, now = new Date()) {
  await hit(db, LIMITS.invitePreviewByIp, ip, now);
  const group = await groupByInvite(db, token);
  if (!group) return null;
  const [{ n }] = await db
    .select({ n: count() })
    .from(members)
    .where(and(eq(members.groupId, group.id), isNull(members.leftAt)));
  let alreadyMember = false;
  if (user) {
    const [m] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.groupId, group.id), eq(members.userId, user.id), isNull(members.leftAt)));
    alreadyMember = !!m;
  }
  return { groupId: group.id, name: group.name, memberCount: n, full: n >= MAX_MEMBERS, alreadyMember };
}

export async function joinGroup(
  db: Db,
  user: User,
  token: string,
  rawDisplayName: string,
  ip: string,
  now = new Date(),
) {
  const displayName = nameSchema.parse(rawDisplayName);
  await hit(db, LIMITS.joinByIp, ip, now);
  return db.transaction(async (tx) => {
    const group = await groupByInvite(tx, token, true);
    if (!group) throw new AppError("invalid", "This invite link is no longer valid. Ask for a new one.");

    const [existing] = await tx
      .select()
      .from(members)
      .where(and(eq(members.groupId, group.id), eq(members.userId, user.id)));
    if (existing && !existing.leftAt) return group.id;

    const [{ n }] = await tx
      .select({ n: count() })
      .from(members)
      .where(and(eq(members.groupId, group.id), isNull(members.leftAt)));
    if (n >= MAX_MEMBERS) throw new AppError("conflict", `This group is full (${MAX_MEMBERS} people).`);

    const [taken] = await tx
      .select({ userId: members.userId })
      .from(members)
      .where(
        and(
          eq(members.groupId, group.id),
          isNull(members.leftAt),
          ne(members.userId, user.id),
          sql`lower(${members.displayName}) = lower(${displayName})`,
        ),
      );
    if (taken) throw new AppError("conflict", `Someone in this group is already called "${displayName}". Pick another name.`);

    if (existing) {
      await tx
        .update(members)
        .set({ leftAt: null, displayName, role: "member", joinedAt: now })
        .where(and(eq(members.groupId, group.id), eq(members.userId, user.id)));
    } else {
      await tx.insert(members).values({ groupId: group.id, userId: user.id, displayName, role: "member", joinedAt: now });
    }
    const others = await groupMemberIds(tx, group.id, [user.id]);
    await emit(tx, { type: "member_joined", groupId: group.id, actorId: user.id, userIds: others, now });
    return group.id;
  });
}

/** Makes the old invite link stop working and returns the new token. */
export async function resetInvite(db: Db, user: User, groupId: string) {
  return db.transaction(async (tx) => {
    await requireAdmin(tx, user, groupId);
    const inviteToken = newInviteToken();
    await tx.update(groups).set({ inviteToken }).where(eq(groups.id, groupId));
    return inviteToken;
  });
}

/** Leaves a group. If the admin leaves, the longest-standing remaining member becomes admin. */
export async function leaveGroup(db: Db, user: User, groupId: string, now = new Date()) {
  await db.transaction(async (tx) => {
    // Lock the group so two admins can't hand over at the same moment.
    await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).for("update");
    const me = await requireMember(tx, user, groupId);
    await tx
      .update(members)
      .set({ leftAt: now, role: "member" })
      .where(and(eq(members.groupId, groupId), eq(members.userId, user.id)));
    if (me.role !== "admin") return;
    const [next] = await tx
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.groupId, groupId), isNull(members.leftAt)))
      .orderBy(asc(members.joinedAt))
      .limit(1);
    if (next) {
      await tx
        .update(members)
        .set({ role: "admin" })
        .where(and(eq(members.groupId, groupId), eq(members.userId, next.userId)));
    }
  });
}

async function groupByInvite(db: Db | Tx, token: string, lock = false) {
  // Tokens are 22 base64url characters; reject anything else without touching the index.
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return null;
  const q = db.select().from(groups).where(eq(groups.inviteToken, token));
  const [group] = lock ? await q.for("update") : await q;
  return group ?? null;
}
