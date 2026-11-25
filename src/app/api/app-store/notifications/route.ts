import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { handleNotification } from "@/server/subscriptions";

/**
 * App Store Server Notifications v2: Apple tells us about renewals, expiry, billing problems, refunds and
 * revocation. The body is signed by Apple and verified before anything is applied (subscriptions.ts).
 * Set this URL (https://<site>/api/app-store/notifications) for Production and Sandbox in App Store Connect.
 * Answers 200 once applied; anything else makes Apple retry later.
 */
export async function POST(req: Request) {
  let signedPayload: unknown;
  try {
    ({ signedPayload } = (await req.json()) as { signedPayload?: unknown });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (typeof signedPayload !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const result = await handleNotification(await getDb(), signedPayload);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
