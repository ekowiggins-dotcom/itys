/**
 * Deleting an account removes the person, not just their login:
 * - They leave every group first (admin is handed to the longest-standing member).
 * - Calls about them are taken down, since their text may name them.
 * - Their user row is deleted. Sessions, memberships (and so their name), picks, votes, scores, notifications,
 *   reports and blocks go with it. Calls they wrote stay for the group, shown as by "Former member".
 * Unused sign-in links for their email are deleted too. Names are never copied into other rows, so nothing
 * else keeps them.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { User } from "./auth";
import { calls, loginTokens, members, users } from "./db/schema";
import type { Db } from "./db/types";
import { leaveGroup } from "./groups";
import { revokeApple, type Fetch } from "./apple";

export async function deleteAccount(db: Db, user: User, now = new Date(), fetcher: Fetch = fetch) {
  // Sign in with Apple: revoke the app's access at Apple too (best effort; needs the Sign in with Apple key).
  const [{ appleRefreshToken } = { appleRefreshToken: null }] = await db
    .select({ appleRefreshToken: users.appleRefreshToken })
    .from(users)
    .where(eq(users.id, user.id));
  await revokeApple(appleRefreshToken, fetcher, now.getTime()).catch(() => false);

  const groupsIn = await db
    .select({ groupId: members.groupId })
    .from(members)
    .where(and(eq(members.userId, user.id), isNull(members.leftAt)));
  for (const { groupId } of groupsIn) await leaveGroup(db, user, groupId, now);

  await db.transaction(async (tx) => {
    const about = await tx.select({ id: calls.id, status: calls.status }).from(calls).where(eq(calls.subjectId, user.id));
    for (const c of about) {
      const open = c.status === "active" || c.status === "proposed" || c.status === "disputed";
      await tx
        .update(calls)
        .set({
          moderation: "removed",
          nextActionAt: null,
          ...(open ? { status: "void" as const, voidReason: "removed", settledAt: now } : {}),
        })
        .where(eq(calls.id, c.id));
    }
    if (user.email) await tx.delete(loginTokens).where(eq(loginTokens.email, user.email));
    await tx.delete(users).where(eq(users.id, user.id));
  });
}
