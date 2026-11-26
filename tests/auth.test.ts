import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { logout, logoutEverywhere, SESSION_REFRESH_MS, SESSION_TTL_MS, startSession, userForSession } from "@/server/auth";
import { hashToken } from "@/server/crypto";
import { sessions } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("sessions", () => {
  it("stores only a hash of the session token", async () => {
    const { sessionToken } = await signUp(db, "Hash");
    const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(sessionToken)));
    expect(row).toBeDefined();
    const plain = await db.select().from(sessions).where(eq(sessions.tokenHash, sessionToken));
    expect(plain).toHaveLength(0);
  });

  it("expires after 30 days without use", async () => {
    const t0 = new Date("2026-02-01T00:00:00Z");
    const { user, sessionToken } = await signUp(db, "Expiring", t0);
    expect((await userForSession(db, sessionToken, t0))?.id).toBe(user.id);
    expect(await userForSession(db, sessionToken, new Date(t0.getTime() + SESSION_TTL_MS + 1))).toBeNull();
  });

  it("slides forward while used, writing at most once a day", async () => {
    const t0 = new Date("2026-03-01T00:00:00Z");
    const { sessionToken } = await signUp(db, "Slider", t0);
    const read = async () =>
      (await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(sessionToken))))[0];

    await userForSession(db, sessionToken, new Date(t0.getTime() + 3600_000));
    expect((await read()).expiresAt.getTime()).toBe(t0.getTime() + SESSION_TTL_MS); // unchanged within a day

    const later = new Date(t0.getTime() + SESSION_REFRESH_MS + 1);
    await userForSession(db, sessionToken, later);
    expect((await read()).expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS);

    // Still valid past the original 30 days because it was used.
    expect(await userForSession(db, sessionToken, new Date(t0.getTime() + SESSION_TTL_MS + 1000))).not.toBeNull();
  });

  it("signs out one device, or every device", async () => {
    const { user, sessionToken } = await signUp(db, "Multi");
    const second = await startSession(db, user.id);
    await logout(db, sessionToken);
    expect(await userForSession(db, sessionToken)).toBeNull();
    expect(await userForSession(db, second.sessionToken)).not.toBeNull();
    await logoutEverywhere(db, user);
    expect(await userForSession(db, second.sessionToken)).toBeNull();
  });

  it("treats a missing or unknown token as signed out", async () => {
    expect(await userForSession(db, undefined)).toBeNull();
    expect(await userForSession(db, "nope")).toBeNull();
  });
});
