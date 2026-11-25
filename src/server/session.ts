import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { userForSession, type User } from "./auth";
import { getDb } from "./db";
import { AppError } from "./errors";
import { APP_COOKIE, isAppClient } from "@/lib/app-client";

export const SESSION_COOKIE = "wholl_session";

/** The signed-in user for this request, or null. Cached per request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userForSession(await getDb(), token);
});

/** The signed-in user; otherwise redirects to sign-in and comes back to `returnTo` afterwards. */
export async function requireUser(returnTo: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!user.name && returnTo !== "/welcome" && !returnTo.startsWith("/welcome?")) {
    redirect(`/welcome?next=${encodeURIComponent(returnTo)}`);
  }
  return user;
}

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The client's IP for rate limiting. Behind a proxy (Railway, Vercel), the first X-Forwarded-For entry. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * The public origin used in links we send (emails, invites). Production must set APP_ORIGIN, so a forged
 * Host header can never change where links point. Development falls back to the request host.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.APP_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_ORIGIN is required in production.");
  const host = (await headers()).get("host") ?? "localhost:3000";
  return `http://${host}`;
}

/** Only same-site paths are allowed as redirect targets (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/groups"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** True when the request comes from the iOS app (see src/lib/app-client.ts). Sign-in is only offered there. */
export async function isAppRequest(): Promise<boolean> {
  const ua = (await headers()).get("user-agent");
  return isAppClient(ua, (await cookies()).get(APP_COOKIE)?.value);
}

/** Throws unless the request comes from the iOS app. Used by every sign-in action. */
export async function requireApp() {
  if (!(await isAppRequest())) throw new AppError("forbidden", "Sign in with the Who’ll app on your iPhone.");
}
