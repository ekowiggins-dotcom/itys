// Background worker for production: runs due call steps every 30 seconds against DATABASE_URL.
// Run as its own process (e.g. a second Railway service with start command `npm run worker`).
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";
import { runDueCalls } from "../src/server/lifecycle";
import type { Db } from "../src/server/db/types";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const client = postgres(url, { max: 2 });
const db = drizzle(client, { schema }) as unknown as Db;

let stopping = false;
const stop = async () => {
  stopping = true;
  await client.end({ timeout: 5 });
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

console.log("Worker started.");
while (!stopping) {
  try {
    const r = await runDueCalls(db, new Date());
    if (r.advanced) console.log(`Advanced ${r.advanced} call(s).`);
  } catch (e) {
    console.error("Worker tick failed; retrying.", e);
  }
  await new Promise((r) => setTimeout(r, 30_000));
}
