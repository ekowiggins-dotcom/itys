/**
 * The website's waitlist: people who saw an ad leave their email (and, if they like, how many friends would join
 * their group). No email is sent. Rows are read with `npm run waitlist:export`.
 *
 * - Emails are lower-cased; signing up again with the same email just succeeds (nothing changes, nothing leaks).
 * - A hidden "website" field catches bots: if it's filled we pretend it worked and save nothing.
 * - Rate-limited per IP.
 */
import { count, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { waitlist } from "./db/schema";
import type { Db } from "./db/types";
import { hit, LIMITS } from "./rate-limit";

export const GROUP_SIZES = ["2-4", "5-8", "9+"] as const;
export type GroupSize = (typeof GROUP_SIZES)[number];
export const WAITLIST_LOCALES = ["en", "tr"] as const;
export type WaitlistLocale = (typeof WAITLIST_LOCALES)[number];

/** Ad tags are free text from a URL: keep them short and printable. */
const tag = z
  .string()
  .trim()
  .max(100)
  .transform((s) => s.replace(/[^\p{L}\p{N} ._\-:/+]/gu, "").slice(0, 100) || null)
  .nullish();

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  locale: z.enum(WAITLIST_LOCALES).catch("en"),
  groupSize: z.enum(GROUP_SIZES).nullish().catch(null),
  source: tag,
  campaign: tag,
  content: tag,
  /** The honeypot. People never see it. */
  website: z.string().nullish(),
});
export type WaitlistInput = z.input<typeof inputSchema>;

/** Adds someone to the waitlist. Throws a ZodError for a bad email, "rate_limited" when one IP sends too many. */
export async function joinWaitlist(db: Db, input: WaitlistInput, ip: string, now = new Date()) {
  const data = inputSchema.parse(input);
  await hit(db, LIMITS.waitlistByIp, ip, now);
  if (data.website) return { ok: true as const }; // a bot filled the hidden field
  await db
    .insert(waitlist)
    .values({
      email: data.email,
      locale: data.locale,
      groupSize: data.groupSize ?? null,
      source: data.source ?? null,
      campaign: data.campaign ?? null,
      content: data.content ?? null,
      createdAt: now,
    })
    .onConflictDoNothing({ target: waitlist.email });
  return { ok: true as const };
}

/** Everything on the waitlist, newest first, with counts by source and by group size. */
export async function waitlistReport(db: Db) {
  const rows = await db.select().from(waitlist).orderBy(desc(waitlist.createdAt));
  const bySource = await db
    .select({ source: sql<string>`coalesce(${waitlist.source}, '(none)')`, campaign: sql<string>`coalesce(${waitlist.campaign}, '')`, n: count() })
    .from(waitlist)
    .groupBy(sql`1`, sql`2`)
    .orderBy(desc(count()));
  const byGroupSize = await db
    .select({ groupSize: sql<string>`coalesce(${waitlist.groupSize}, '(not answered)')`, n: count() })
    .from(waitlist)
    .groupBy(sql`1`)
    .orderBy(desc(count()));
  return { rows, bySource, byGroupSize };
}

const csvCell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
  // Quote everything that needs it; a leading =, +, - or @ is escaped so spreadsheets don't run it as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const csvLine = (cells: unknown[]) => cells.map(csvCell).join(",");

/** The report as one CSV text: the sign-ups, then counts by source and by group size. */
export function waitlistCsv(report: Awaited<ReturnType<typeof waitlistReport>>) {
  return [
    csvLine(["email", "locale", "group_size", "source", "campaign", "content", "created_at"]),
    ...report.rows.map((r) => csvLine([r.email, r.locale, r.groupSize, r.source, r.campaign, r.content, r.createdAt])),
    "",
    csvLine(["source", "campaign", "signups"]),
    ...report.bySource.map((r) => csvLine([r.source, r.campaign, r.n])),
    "",
    csvLine(["group_size", "signups"]),
    ...report.byGroupSize.map((r) => csvLine([r.groupSize, r.n])),
  ].join("\n");
}
