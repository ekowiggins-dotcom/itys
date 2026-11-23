import { NextResponse } from "next/server";
import { cronAuthorized, runJobsOnce } from "@/server/jobs";

/**
 * Runs due background steps (choosing settlers, closing disputes and votes, voiding stale calls).
 * Call it every minute from a scheduler with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runJobsOnce());
}
