import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { storage } from '../../../lib/storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Railway's deploy health check. Fails in production without a persistent volume,
// so a deploy can never go live with data that would vanish on the next redeploy.
export async function GET() {
  const s = storage();
  if (!s.persistent) return NextResponse.json({ ok: false, error: 'No persistent volume attached. In Railway, add a volume to this service (any mount path, e.g. /data) and redeploy.' }, { status: 503 });
  try {
    await (await db()).query('SELECT 1');
    return NextResponse.json({ ok: true, storage: s.source }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }
}
