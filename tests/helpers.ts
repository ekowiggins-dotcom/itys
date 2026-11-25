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

/** Gives someone an active Who'll Pro subscription (as if bought in the app), so their groups can have 5+ people. */
export async function givePro(db: Db, userId: string, expiresAt = new Date("2099-01-01T00:00:00Z")) {
  const id = `test-${userId}`;
  await db
    .insert(schema.subscriptions)
    .values({
      originalTransactionId: id,
      userId,
      productId: "app.wholl.ios.pro.yearly",
      transactionId: id,
      environment: "Sandbox",
      purchasedAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt,
    })
    .onConflictDoUpdate({ target: schema.subscriptions.originalTransactionId, set: { expiresAt, revokedAt: null } });
}
