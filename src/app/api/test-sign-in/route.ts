import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { startSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { safeNext, SESSION_COOKIE } from "@/server/session";

/**
 * Browser tests only: signs in as an email address, since Sign in with Apple can't run in a test browser.
 * Exists only in development with E2E_SIGN_IN=1 (set by scripts/e2e-server.mjs); everywhere else it's a 404.
 *   GET /api/test-sign-in?email=ada@example.com&next=/groups
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.E2E_SIGN_IN !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return new NextResponse("email is required", { status: 400 });
  const db = await getDb();
  await db.insert(users).values({ email }).onConflictDoNothing({ target: users.email });
  const [user] = await db.select().from(users).where(eq(users.email, email));
  const { sessionToken, expiresAt } = await startSession(db, user.id);
  const next = safeNext(url.searchParams.get("next"));
  const dest = user.name ? next : `/welcome?next=${encodeURIComponent(next)}`;
  const res = NextResponse.redirect(new URL(dest, url));
  res.cookies.set(SESSION_COOKIE, sessionToken, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
  return res;
}
