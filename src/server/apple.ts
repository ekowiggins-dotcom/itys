/**
 * Sign in with Apple.
 *
 * - The client gets a one-time nonce from us (kept in a short-lived httpOnly cookie), sends its SHA-256 to Apple,
 *   and gets back an identity token (a JWT signed by Apple) carrying that hash. We verify the signature against
 *   Apple's published keys, the issuer, the audience (our app or web Services ID), the expiry and the nonce, so a
 *   stolen token can't be replayed.
 * - Apple's keys are cached for an hour and refetched when a token names a key we don't have (Apple rotates them).
 * - People are found by Apple's stable user id. If Apple shares a verified email that matches an existing account,
 *   that account is linked instead of making a second one.
 * - When APPLE_SIGNIN_KEY (+ _KEY_ID, APPLE_TEAM_ID) is configured, the one-time authorization code is exchanged for
 *   a refresh token, which lets account deletion revoke the app's access at Apple, as Apple asks.
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify, type JsonWebKey } from "node:crypto";
import { eq } from "drizzle-orm";
import type { User } from "./auth";
import { SESSION_TTL_MS } from "./auth";
import { hashToken, randomToken } from "./crypto";
import { sessions, users } from "./db/schema";
import type { Db } from "./db/types";
import { AppError } from "./errors";
import { hit, LIMITS } from "./rate-limit";

const ISSUER = "https://appleid.apple.com";
const KEYS_URL = "https://appleid.apple.com/auth/keys";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Who a token may be for: the iOS app's bundle id, and the web Services ID if there is one. */
export function appleAudiences() {
  return [process.env.IOS_BUNDLE_ID ?? "app.wholl.ios", process.env.APPLE_SERVICES_ID].filter((a): a is string => !!a);
}

export const newNonce = () => randomToken(24);
export const nonceHash = (nonce: string) => createHash("sha256").update(nonce).digest("hex");

type Jwk = JsonWebKey & { kid: string };
let keyCache: { keys: Jwk[]; at: number } | undefined;

async function appleKeys(fetcher: Fetch, kid: string, now: number) {
  const fresh = keyCache && now - keyCache.at < 3_600_000;
  if (!fresh || !keyCache!.keys.some((k) => k.kid === kid)) {
    const res = await fetcher(KEYS_URL);
    if (!res.ok) throw new AppError("invalid", "Couldn’t reach Apple to check your sign-in. Try again.");
    keyCache = { keys: ((await res.json()) as { keys: Jwk[] }).keys, at: now };
  }
  return keyCache!.keys;
}

/** For tests. */
export const _resetAppleKeys = () => (keyCache = undefined);

export type AppleClaims = { sub: string; email?: string; emailVerified: boolean };

/** Verifies an Apple identity token. Throws "invalid" for anything wrong. */
export async function verifyAppleToken(idToken: string, rawNonce: string | undefined, fetcher: Fetch = fetch, now = Date.now()): Promise<AppleClaims> {
  const bad = () => new AppError("invalid", "Sign in with Apple didn’t work. Please try again.");
  const parts = idToken.split(".");
  if (parts.length !== 3) throw bad();
  let header: { alg?: string; kid?: string };
  let claims: { iss?: string; aud?: string; exp?: number; iat?: number; sub?: string; nonce?: string; email?: string; email_verified?: boolean | string };
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    throw bad();
  }
  if (header.alg !== "RS256" || !header.kid) throw bad();
  const jwk = (await appleKeys(fetcher, header.kid, now)).find((k) => k.kid === header.kid);
  if (!jwk) throw bad();
  const ok = verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(parts[2], "base64url"),
  );
  if (!ok) throw bad();
  const seconds = Math.floor(now / 1000);
  if (claims.iss !== ISSUER || !claims.sub) throw bad();
  if (!claims.aud || !appleAudiences().includes(claims.aud)) throw bad();
  if (!claims.exp || claims.exp < seconds - 60) throw bad();
  if (claims.iat && claims.iat > seconds + 300) throw bad();
  if (!rawNonce || claims.nonce !== nonceHash(rawNonce)) throw bad();
  return {
    sub: claims.sub,
    email: claims.email?.trim().toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
  };
}

/** The client secret for Apple's token endpoints: a short-lived JWT signed with the Sign in with Apple key. */
function clientSecret(clientId: string, now: number) {
  const key = process.env.APPLE_SIGNIN_KEY;
  const keyId = process.env.APPLE_SIGNIN_KEY_ID;
  const team = process.env.APPLE_TEAM_ID ?? process.env.APNS_TEAM_ID;
  if (!key || !keyId || !team) return null;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(now / 1000);
  const head = `${b64({ alg: "ES256", kid: keyId })}.${b64({ iss: team, iat, exp: iat + 300, aud: ISSUER, sub: clientId })}`;
  const sig = sign("sha256", Buffer.from(head), { key: createPrivateKey(key.replace(/\\n/g, "\n")), dsaEncoding: "ieee-p1363" });
  return `${head}.${sig.toString("base64url")}`;
}

/** Exchanges the one-time authorization code for a refresh token (only when the Sign in with Apple key is set). */
async function refreshTokenFor(code: string | undefined, clientId: string, fetcher: Fetch, now: number) {
  const secret = code ? clientSecret(clientId, now) : null;
  if (!code || !secret) return null;
  const res = await fetcher(`${ISSUER}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: secret, code, grant_type: "authorization_code" }),
  });
  if (!res.ok) return null; // sign-in still works; only revocation on deletion is skipped
  return ((await res.json()) as { refresh_token?: string }).refresh_token ?? null;
}

/** Revokes the app's Sign in with Apple access (account deletion). Best effort. */
export async function revokeApple(refreshToken: string | null, fetcher: Fetch = fetch, now = Date.now()) {
  if (!refreshToken) return false;
  for (const clientId of appleAudiences()) {
    const secret = clientSecret(clientId, now);
    if (!secret) return false;
    const res = await fetcher(`${ISSUER}/auth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: secret, token: refreshToken, token_type_hint: "refresh_token" }),
    }).catch(() => null);
    if (res?.ok) return true;
  }
  return false;
}

export type AppleSignIn = {
  idToken: string;
  rawNonce: string | undefined;
  authorizationCode?: string;
  /** Only sent by Apple the first time someone signs in; trusted only as a suggested display name. */
  givenName?: string;
};

/** Signs someone in with Apple: finds or creates their account and starts a session. */
export async function appleSignIn(db: Db, input: AppleSignIn, ip: string, fetcher: Fetch = fetch, now = new Date()) {
  await hit(db, LIMITS.loginByIp, ip, now);
  const claims = await verifyAppleToken(input.idToken, input.rawNonce, fetcher, now.getTime());
  const audience = JSON.parse(Buffer.from(input.idToken.split(".")[1], "base64url").toString()).aud as string;
  const refresh = await refreshTokenFor(input.authorizationCode, audience, fetcher, now.getTime());
  const suggested = input.givenName?.trim().slice(0, 30) || null;

  return db.transaction(async (tx) => {
    let [row] = await tx.select().from(users).where(eq(users.appleSub, claims.sub));
    if (!row && claims.email && claims.emailVerified) {
      // Link to an existing account with the same verified email (e.g. someone who signed in by email before).
      [row] = await tx.select().from(users).where(eq(users.email, claims.email));
      if (row) [row] = await tx.update(users).set({ appleSub: claims.sub }).where(eq(users.id, row.id)).returning();
    }
    if (!row) {
      const emailFree = claims.email && claims.emailVerified
        ? (await tx.select({ id: users.id }).from(users).where(eq(users.email, claims.email))).length === 0
        : false;
      [row] = await tx
        .insert(users)
        .values({ appleSub: claims.sub, email: emailFree ? claims.email : null, name: suggested })
        .returning();
    }
    if (refresh) await tx.update(users).set({ appleRefreshToken: refresh }).where(eq(users.id, row.id));

    const sessionToken = randomToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await tx.insert(sessions).values({ tokenHash: hashToken(sessionToken), userId: row.id, expiresAt, lastSeenAt: now });
    const user: User = { id: row.id, email: row.email, name: row.name, emailAlerts: row.emailAlerts };
    return { sessionToken, expiresAt, user };
  });
}
