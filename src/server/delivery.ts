/**
 * Delivers the outbox (emails now; push in the iOS step).
 * - Rows are claimed with a 5-minute lease (status "sending"). If a worker dies mid-send, the lease expires and
 *   the row is picked up again: nothing gets stuck in "sending" (a flaw in the old app).
 * - Failures retry with backoff (2, 4, 8, 16 minutes), then give up after MAX_ATTEMPTS.
 * - Anything older than MAX_AGE is expired rather than sent late.
 */
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { SendPush } from "./apns";
import { devices, notifications, outbox, users } from "./db/schema";
import type { Db } from "./db/types";
import { renderEmail } from "./email-template";
import type { SendEmail } from "./mailer";
import { renderNotifications, unreadCount } from "./notifications";

export const LEASE_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 5;
export const MAX_AGE_MS = 24 * 3600_000;

export const backoffMs = (attempts: number) => 2 ** attempts * 60_000;

function origin() {
  return (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
}

export type Senders = { email: SendEmail; push?: SendPush };

export async function deliverOutbox(db: Db, senders: SendEmail | Senders, now = new Date(), limit = 50) {
  const { email: send, push } = typeof senders === "function" ? { email: senders, push: undefined } : senders;
  await db
    .update(outbox)
    .set({ status: "expired", leaseUntil: null })
    .where(
      and(inArray(outbox.status, ["queued", "sending"]), lt(outbox.createdAt, new Date(now.getTime() - MAX_AGE_MS))),
    );

  // Claim due rows (queued and due, or sending with an expired lease) in one statement.
  const claimed = await db.execute<{ id: string }>(sql`
    UPDATE ${outbox} SET status = 'sending', lease_until = ${new Date(now.getTime() + LEASE_MS)}, attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM ${outbox}
      WHERE (status = 'queued' AND next_try_at <= ${now}) OR (status = 'sending' AND lease_until < ${now})
      ORDER BY next_try_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`);
  const ids = (Array.isArray(claimed) ? claimed : (claimed as { rows: { id: string }[] }).rows).map((r) => r.id);
  if (ids.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  const rows = await db
    .select({ outbox, notification: notifications, email: users.email, emailAlerts: users.emailAlerts })
    .from(outbox)
    .innerJoin(notifications, eq(notifications.id, outbox.notificationId))
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(inArray(outbox.id, ids));

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    const [rendered] = await renderNotifications(db, row.notification.userId, [row.notification]);
    const isPush = row.outbox.channel === "push";
    // Left the group, turned email alerts off, or it's no longer needed (e.g. already settled): don't send.
    if (!rendered || (!isPush && !row.emailAlerts) || !rendered.stillNeeded || (isPush && !push)) {
      await db.update(outbox).set({ status: "expired", leaseUntil: null }).where(eq(outbox.id, row.outbox.id));
      skipped++;
      continue;
    }
    try {
      if (isPush) {
        const phones = await db
          .select({ token: devices.token, environment: devices.environment })
          .from(devices)
          .where(and(eq(devices.userId, row.notification.userId), isNull(devices.disabledAt)));
        if (phones.length === 0) {
          await db.update(outbox).set({ status: "expired", leaseUntil: null }).where(eq(outbox.id, row.outbox.id));
          skipped++;
          continue;
        }
        const results = await push!(phones, {
          title: rendered.groupName,
          body: rendered.text,
          href: rendered.href,
          badge: await unreadCount(db, { id: row.notification.userId, email: "", name: null }),
        });
        for (const r of results) {
          if (r.gone) await db.update(devices).set({ disabledAt: now }).where(eq(devices.token, r.token));
          else if (r.ok && r.environment) await db.update(devices).set({ environment: r.environment }).where(eq(devices.token, r.token));
        }
        // Retry only if no phone got it and at least one failure might be temporary.
        if (!results.some((r) => r.ok) && results.some((r) => !r.gone)) {
          throw new Error(results.find((r) => !r.ok && !r.gone)?.error ?? "push failed");
        }
        await db.update(outbox).set({ status: "sent", leaseUntil: null, lastError: null }).where(eq(outbox.id, row.outbox.id));
        sent++;
        continue;
      }
      const email = renderEmail({
        preview: rendered.text,
        heading: rendered.groupName,
        body: rendered.text,
        button: { label: "Open Who’ll", url: `${origin()}${rendered.href}` },
        footer: "You get these emails when something needs you. Turn them off in Settings.",
      });
      await send(
        row.email,
        `${rendered.groupName}: ${rendered.text.length > 70 ? rendered.text.slice(0, 67) + "…" : rendered.text}`,
        email.text,
        email.html,
      );
      await db.update(outbox).set({ status: "sent", leaseUntil: null, lastError: null }).where(eq(outbox.id, row.outbox.id));
      sent++;
    } catch (e) {
      const attempts = row.outbox.attempts;
      const giveUp = attempts >= MAX_ATTEMPTS;
      await db
        .update(outbox)
        .set({
          status: giveUp ? "failed" : "queued",
          leaseUntil: null,
          nextTryAt: new Date(now.getTime() + backoffMs(attempts)),
          lastError: String(e instanceof Error ? e.message : e).slice(0, 500),
        })
        .where(eq(outbox.id, row.outbox.id));
      failed++;
    }
  }
  return { sent, failed, skipped };
}

/** For tests and the status page: counts by status. */
export async function outboxCounts(db: Db) {
  const rows = await db.select({ status: outbox.status }).from(outbox);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
}

