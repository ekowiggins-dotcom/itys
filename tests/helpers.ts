import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { setName, startSession } from "@/server/auth";

/** A fresh in-memory Postgres with all migrations applied. Each test file gets its own. */
export async function testDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Db;
}

let n = 0;
/** Makes a new user with a name and a session (as Sign in with Apple would) and returns them with the token. */
export async function signUp(db: Db, name = `User${++n}`, now = new Date()) {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${name.toLowerCase()}-${++n}@example.com`, appleSub: `apple-${n}-${name}` })
    .returning();
  const { sessionToken } = await startSession(db, row.id, now);
  await setName(db, { id: row.id, email: row.email, name: null }, name);
  return { user: { id: row.id, email: row.email, name, emailAlerts: row.emailAlerts }, sessionToken };
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
