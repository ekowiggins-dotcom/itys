// Prints the waitlist as CSV: every sign-up, then counts by ad source and by group size.
//   npm run waitlist:export > waitlist.csv        (with DATABASE_URL set, e.g. `railway run npm run waitlist:export`)
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";
import type { Db } from "../src/server/db/types";
import { waitlistCsv, waitlistReport } from "../src/server/waitlist";

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (or DATABASE_PUBLIC_URL when running from your own computer).");
  process.exit(1);
}
const client = postgres(url, { max: 1 });
const report = await waitlistReport(drizzle(client, { schema }) as unknown as Db);
process.stdout.write(waitlistCsv(report) + "\n");
console.error(`${report.rows.length} on the waitlist.`);
await client.end();
