import { generateKeyPairSync, sign } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { deleteAccount } from "@/server/account";
import { _resetAppleKeys, appleSignIn, nonceHash, verifyAppleToken, type Fetch } from "@/server/apple";
import { userForSession } from "@/server/auth";
import { users } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { signUp, testDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

/** A fake Apple: our own RSA key published as Apple's, and tokens signed with it. */
function fakeApple(kid = "k1") {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" };
  const calls: string[] = [];
  const fetcher: Fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("/auth/keys")) return new Response(JSON.stringify({ keys: [jwk] }));
    if (url.endsWith("/auth/token")) return new Response(JSON.stringify({ refresh_token: "rt-123" }));
    if (url.endsWith("/auth/revoke")) return new Response("", { status: 200 });
    return new Response("", { status: 404 });
  };
  const token = (claims: Record<string, unknown>, opts: { kid?: string; key?: typeof privateKey } = {}) => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const head = `${b64({ alg: "RS256", kid: opts.kid ?? kid })}.${b64(claims)}`;
    return `${head}.${sign("RSA-SHA256", Buffer.from(head), opts.key ?? privateKey).toString("base64url")}`;
  };
  return { fetcher, token, calls };
}

const NOW = Date.UTC(2026, 11, 1, 12);
const S = Math.floor(NOW / 1000);
const base = (nonce: string, extra: Record<string, unknown> = {}) => ({
  iss: "https://appleid.apple.com",
  aud: "app.wholl.ios",
  sub: "apple-user-1",
  iat: S,
  exp: S + 600,
  nonce: nonceHash(nonce),
  ...extra,
});

beforeEach(() => {
  _resetAppleKeys();
  delete process.env.APPLE_SERVICES_ID;
});

describe("verifying Apple identity tokens", () => {
  it("accepts a correctly signed token for our app with the right nonce", async () => {
    const a = fakeApple();
    const claims = await verifyAppleToken(a.token(base("n1", { email: "Ada@Privaterelay.appleid.com", email_verified: "true" })), "n1", a.fetcher, NOW);
    expect(claims).toEqual({ sub: "apple-user-1", email: "ada@privaterelay.appleid.com", emailVerified: true });
  });

  it.each([
    ["another app", { aud: "com.someone.else" }],
    ["another issuer", { iss: "https://evil.example" }],
    ["an expired token", { exp: S - 120 }],
    ["no subject", { sub: "" }],
  ])("rejects %s", async (_n, extra) => {
    const a = fakeApple();
    await expect(verifyAppleToken(a.token(base("n2", extra)), "n2", a.fetcher, NOW)).rejects.toThrow(/didn’t work/);
  });

  it("rejects a replayed token (wrong or missing nonce) and a forged signature", async () => {
    const a = fakeApple();
    const t = a.token(base("real-nonce"));
    await expect(verifyAppleToken(t, "other-nonce", a.fetcher, NOW)).rejects.toThrow();
    await expect(verifyAppleToken(t, undefined, a.fetcher, NOW)).rejects.toThrow();
    const forger = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    await expect(verifyAppleToken(a.token(base("n3"), { key: forger }), "n3", a.fetcher, NOW)).rejects.toThrow();
  });

  it("accepts the web Services ID when one is configured", async () => {
    process.env.APPLE_SERVICES_ID = "app.wholl.web";
    const a = fakeApple();
    await verifyAppleToken(a.token(base("n4", { aud: "app.wholl.web" })), "n4", a.fetcher, NOW);
  });

  it("refetches Apple's keys when a token names a new key (key rotation)", async () => {
    const a = fakeApple("old");
    await verifyAppleToken(a.token(base("n5")), "n5", a.fetcher, NOW);
    const b = fakeApple("new");
    await verifyAppleToken(b.token(base("n6")), "n6", b.fetcher, NOW + 1000); // cache still fresh, but kid unknown
    expect(b.calls.filter((u) => u.endsWith("/auth/keys"))).toHaveLength(1);
  });
});

describe("signing in with Apple", () => {
  it("creates an account once, then signs the same Apple ID into it", async () => {
    const a = fakeApple();
    const first = await appleSignIn(db, { idToken: a.token(base("s1", { sub: "sub-A" })), rawNonce: "s1", givenName: "Ada" }, "7.0.0.1", a.fetcher, new Date(NOW));
    expect(first.user.name).toBe("Ada");
    expect(first.user.email).toBeNull(); // no email shared
    expect((await userForSession(db, first.sessionToken, new Date(NOW)))?.id).toBe(first.user.id);
    const again = await appleSignIn(db, { idToken: a.token(base("s2", { sub: "sub-A" })), rawNonce: "s2" }, "7.0.0.1", a.fetcher, new Date(NOW));
    expect(again.user.id).toBe(first.user.id);
  });

  it("links to an existing account with the same verified email", async () => {
    const { user } = await signUp(db, "Linker");
    const a = fakeApple();
    const r = await appleSignIn(db, { idToken: a.token(base("s3", { sub: "sub-L", email: user.email, email_verified: true })), rawNonce: "s3" }, "7.0.0.2", a.fetcher, new Date(NOW));
    expect(r.user.id).toBe(user.id);
  });

  it("doesn't link on an unverified email", async () => {
    const { user } = await signUp(db, "Unverified");
    const a = fakeApple();
    const r = await appleSignIn(db, { idToken: a.token(base("s4", { sub: "sub-U", email: user.email, email_verified: false })), rawNonce: "s4" }, "7.0.0.3", a.fetcher, new Date(NOW));
    expect(r.user.id).not.toBe(user.id);
  });

  it("stores a refresh token when the Sign in with Apple key is set, and revokes it when the account is deleted", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    process.env.APPLE_SIGNIN_KEY = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    process.env.APPLE_SIGNIN_KEY_ID = "KEY123";
    process.env.APPLE_TEAM_ID = "TEAM123";
    try {
      const a = fakeApple();
      const r = await appleSignIn(db, { idToken: a.token(base("s5", { sub: "sub-R" })), rawNonce: "s5", authorizationCode: "code-1" }, "7.0.0.4", a.fetcher, new Date(NOW));
      const [row] = await db.select().from(users).where(eq(users.id, r.user.id));
      expect(row.appleRefreshToken).toBe("rt-123");
      await deleteAccount(db, r.user, new Date(NOW), a.fetcher);
      expect(a.calls.some((u) => u.endsWith("/auth/revoke"))).toBe(true);
      expect(await db.select().from(users).where(eq(users.id, r.user.id))).toEqual([]);
    } finally {
      delete process.env.APPLE_SIGNIN_KEY;
      delete process.env.APPLE_SIGNIN_KEY_ID;
      delete process.env.APPLE_TEAM_ID;
    }
  });
});
