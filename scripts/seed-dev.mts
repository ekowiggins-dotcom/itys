// Development only: fills the local database with a demo group whose calls are at every stage
// (open, waiting for you to settle, open to dispute, being voted on, settled). Stop `npm run dev` first:
// the embedded dev database allows one process at a time.
//   npm run seed:dev            -> demo group for ada@example.com
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { homedir } from "node:os";
import { join } from "node:path";
import * as schema from "../src/server/db/schema";
import type { Db } from "../src/server/db/types";
import { createGroup, groupForMember, joinGroup } from "../src/server/groups";
import { createCall, pick } from "../src/server/calls";
import { disputeResult, proposeResult, runDueCalls } from "../src/server/lifecycle";

if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") {
  console.error("seed:dev only runs against the local development database.");
  process.exit(1);
}
const dir = process.env.PGLITE_DIR || join(homedir(), ".wholl", "dev-db");
const pg = new PGlite(dir);
const db = drizzle(pg, { schema }) as unknown as Db;
await migrate(db as never, { migrationsFolder: "drizzle" });

async function user(email: string, name: string) {
  await db.insert(schema.users).values({ email, name }).onConflictDoNothing({ target: schema.users.email });
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  return { id: u.id, email: u.email, name: u.name };
}

const H = 3600_000;
const now = Date.now();
const ago = (h: number) => new Date(now - h * H);
const ahead = (h: number) => new Date(now + h * H);

const ada = await user("ada@example.com", "Ada");
const bo = await user("bo@example.com", "Bo");
const cem = await user("cem@example.com", "Cem");
const dee = await user("dee@example.com", "Dee");

const start = ago(24 * 6);
const groupId = await createGroup(db, ada, { name: "Demo flat", timeZone: "Europe/Istanbul", displayName: "Ada" }, start);
const invite = (await groupForMember(db, ada, groupId)).inviteToken!;
for (const [u, n] of [[bo, "Bo"], [cem, "Cem"], [dee, "Dee"]] as const) await joinGroup(db, u, invite, n, "127.0.0.1", start);

// 1. Open for picks.
const open = await createCall(db, bo, groupId, { text: "Will Cem cook dinner this week?", kind: "yes_no", subjectId: cem.id, lockAt: ahead(30), eventAt: ahead(72) }, new Date(now));
await pick(db, dee, open, "no", new Date(now));

// 2. Waiting for Ada to settle: Bo wrote it, Cem and Dee picked, so Ada is the neutral settler.
const settle = await createCall(db, bo, groupId, { text: "Will the landlord fix the heating by Friday?", kind: "yes_no", lockAt: ago(48), eventAt: ago(2) }, ago(72));
await pick(db, cem, settle, "yes", ago(60));
await pick(db, dee, settle, "no", ago(60));

// 3. A result Ada can dispute: Ada picked; Bo settles.
const dispute = await createCall(db, cem, groupId, { text: "Where will we eat on Saturday?", kind: "choice", options: ["Pizza", "Sushi", "Kebab"], lockAt: ago(50), eventAt: ago(20) }, ago(72));
await pick(db, ada, dispute, "o2", ago(60));
await pick(db, dee, dispute, "o1", ago(60));
await runDueCalls(db, ago(49));
const [d] = await db.select().from(schema.calls).where(eq(schema.calls.id, dispute));
const settlerOf = [ada, bo, cem, dee].find((u) => u.id === d.settlerId)!;
await proposeResult(db, settlerOf, dispute, "o1", ago(3));

// 4. A vote Ada can join.
const vote = await createCall(db, dee, groupId, { text: "Who will be late to the cinema?", kind: "member", lockAt: ago(60), eventAt: ago(30) }, ago(80));
await pick(db, ada, vote, bo.id, ago(70));
await pick(db, bo, vote, cem.id, ago(70));
await pick(db, cem, vote, bo.id, ago(70));
await runDueCalls(db, ago(59));
const [v] = await db.select().from(schema.calls).where(eq(schema.calls.id, vote));
const voteSettler = [ada, bo, cem, dee].find((u) => u.id === v.settlerId)!;
await proposeResult(db, voteSettler, vote, cem.id, ago(10));
const disputer = [bo, cem].find((u) => u.id !== voteSettler.id && u.id !== v.subjectId)!;
await disputeResult(db, disputer, vote, bo.id, ago(5));

// 5. Settled.
const done = await createCall(db, ada, groupId, { text: "Will it snow before New Year?", kind: "yes_no", lockAt: ago(120), eventAt: ago(100) }, ago(140));
await pick(db, bo, done, "yes", ago(130));
await pick(db, cem, done, "no", ago(130));
await pick(db, dee, done, "no", ago(130));
await runDueCalls(db, ago(119));
const [s] = await db.select().from(schema.calls).where(eq(schema.calls.id, done));
const doneSettler = [ada, bo, cem, dee].find((u) => u.id === s.settlerId)!;
await proposeResult(db, doneSettler, done, "no", ago(90));
await runDueCalls(db, new Date(now));

await pg.close();
console.log(`Seeded "Demo flat". Sign in as ada@example.com and open /groups/${groupId}`);
