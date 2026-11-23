import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db";

/** For the host's health check: 200 when the app can reach its database, 503 otherwise. */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("Health check failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
