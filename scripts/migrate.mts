// Applies pending migrations from ./drizzle to DATABASE_URL. Runs on every start (see `npm start`), so a deploy
// always has its tables before it serves anything. A Postgres advisory lock makes concurrent starts wait for
// each other instead of racing.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const LOCK = 7_271_993; // any constant; shared by everyone running migrations on this database
const client = postgres(url, { max: 1 }); // one connection, so the lock and the migrations share a session
try {
  await client`select pg_advisory_lock(${LOCK})`;
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
} finally {
  await client`select pg_advisory_unlock(${LOCK})`.catch(() => {});
  await client.end();
}
