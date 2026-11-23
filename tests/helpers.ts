import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { completeLogin, requestLogin, setName } from "@/server/auth";

/** A fresh in-memory Postgres with all migrations applied. Each test file gets its own. */
export async function testDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Db;
}

let n = 0;
/** Signs up a new user with a name and returns them with their session token. */
export async function signUp(db: Db, name = `User${++n}`, now = new Date()) {
  const { token } = await requestLogin(db, `${name.toLowerCase()}-${++n}@example.com`, `10.0.0.${n % 250}`, now);
  const { user, sessionToken } = await completeLogin(db, token, now);
  await setName(db, user, name);
  return { user: { ...user, name }, sessionToken };
}
