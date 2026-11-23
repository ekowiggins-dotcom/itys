import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  completeLogin,
  LOGIN_TOKEN_TTL_MS,
  logout,
  logoutEverywhere,
  requestLogin,
  SESSION_REFRESH_MS,
  SESSION_TTL_MS,
  userForSession,
} from "@/server/auth";
import { hashToken } from "@/server/crypto";
import { loginTokens, sessions } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("sign-in links", () => {
  it("normalises the email and stores only a hash of the token", async () => {
    const { email, token } = await requestLogin(db, "  Ada@Example.COM ", "1.1.1.1");
    expect(email).toBe("ada@example.com");
    const rows = await db.select().from(loginTokens).where(eq(loginTokens.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it("rejects an invalid email", async () => {
    await expect(requestLogin(db, "not-an-email", "1.1.1.2")).rejects.toThrow(/valid email/);
  });

  it("works once, then is used up", async () => {
    const { token } = await requestLogin(db, "once@example.com", "1.1.1.3");
    const first = await completeLogin(db, token);
    expect(first.user.email).toBe("once@example.com");
    await expect(completeLogin(db, token)).rejects.toThrow(/expired or was already used/);
  });

  it("expires after 15 minutes", async () => {
    const t0 = new Date("2026-01-01T10:00:00Z");
    const { token } = await requestLogin(db, "late@example.com", "1.1.1.4", t0);
    const late = new Date(t0.getTime() + LOGIN_TOKEN_TTL_MS + 1);
    await expect(completeLogin(db, token, late)).rejects.toThrow(/expired/);
  });

  it("signs the same email into the same account", async () => {
    const a = await completeLogin(db, (await requestLogin(db, "same@example.com", "1.1.1.5")).token);
    const b = await completeLogin(db, (await requestLogin(db, "SAME@example.com", "1.1.1.5")).token);
    expect(a.user.id).toBe(b.user.id);
  });

  it("rate-limits requests per email", async () => {
    for (let i = 0; i < 5; i++) await requestLogin(db, "spam@example.com", `2.2.2.${i}`);
    await expect(requestLogin(db, "spam@example.com", "2.2.2.99")).rejects.toThrow(/Too many/);
  });

  it("rate-limits requests per IP", async () => {
    for (let i = 0; i < 10; i++) await requestLogin(db, `ip${i}@example.com`, "3.3.3.3");
    await expect(requestLogin(db, "ip-last@example.com", "3.3.3.3")).rejects.toThrow(/Too many/);
  });
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
    const second = await completeLogin(db, (await requestLogin(db, user.email!, "4.4.4.4")).token);
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
