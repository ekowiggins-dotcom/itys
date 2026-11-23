import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { widgetSummary } from "@/server/devices";

/** The home-screen widget's numbers. Read-only, authorised by the widget token (not a session). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const summary = await widgetSummary(await getDb(), token);
  if (!summary) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(summary, { headers: { "cache-control": "no-store" } });
}
