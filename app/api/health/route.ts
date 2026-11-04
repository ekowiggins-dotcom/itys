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
    const d = await db();
    await d.query('SELECT 1');
    // Football feed at a glance (never the key itself): open /api/health to check it after setting API_FOOTBALL_KEY.
    const feed = (await d.query<{ last_success: Date | null; error: string | null }>("SELECT last_success,error FROM football_feed_status WHERE id='api-football'")).rows[0];
    const counts = (await d.query<{ fixtures: number; leagues: number; groups: number }>("SELECT (SELECT count(*)::int FROM football_fixtures) fixtures,(SELECT count(DISTINCT league_id)::int FROM football_feed_windows) leagues,(SELECT count(*)::int FROM groups WHERE group_type IN ('Football','Mixed')) groups")).rows[0];
    const manual = process.env.FOOTBALL_FEED === 'manual';
    const football = { mode: manual ? 'manual' : 'api-football', keySet: !!process.env.API_FOOTBALL_KEY, footballGroups: counts.groups, leaguesLoaded: counts.leagues, fixtures: counts.fixtures, lastSync: feed?.last_success || null, error: feed?.error || null,
      note: manual ? (counts.fixtures ? 'Manual match list: '+counts.fixtures+' matches entered. Manage them at /admin.' : 'Manual match list is empty: add this week’s matches at /admin.') : !process.env.API_FOOTBALL_KEY ? 'Set API_FOOTBALL_KEY in Railway.' : !counts.groups ? 'Create a Football or Mixed group: the feed only syncs when one exists.' : feed?.error ? feed.error : counts.leagues < 8 ? 'Loading leagues: the free plan allows ~10 requests a minute, so this fills in over the next hour.' : 'Feed working.' };
    return NextResponse.json({ ok: true, storage: s.source, football }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }
}
