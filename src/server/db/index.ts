import "server-only";
import type { Db } from "./types";

/**
 * The app's database. Production and normal development use Postgres via DATABASE_URL.
 * Without DATABASE_URL (development only), an embedded PGlite database in ~/.wholl/dev-db is used so the app
 * runs with zero setup. It is never used in production.
 */
const g = globalThis as unknown as { whollDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.whollDb ??= open().catch((e) => {
    g.whollDb = undefined; // don't cache a failed connection; retry on the next request
    throw e;
  });
  return g.whollDb;
}

async function open(): Promise<Db> {
  const schema = await import("./schema");
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    return drizzle(postgres(url, { max: 10 }), { schema }) as unknown as Db;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // Kept outside the project folder: writes inside it would trigger the dev server's file watcher on every query.
  const { mkdir } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = process.env.PGLITE_DIR || join(homedir(), ".wholl", "dev-db");
  await mkdir(dir, { recursive: true });
  const db = drizzle(new PGlite(dir), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Db;
}
