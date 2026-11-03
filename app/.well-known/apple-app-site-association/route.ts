import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// Universal links: invite links (https://<domain>/?invite=…) open the iOS app when it's installed.
// Needs APPLE_TEAM_ID and IOS_BUNDLE_ID; served without redirects as application/json, as Apple requires.
export function GET() {
  const team = process.env.APPLE_TEAM_ID || process.env.APNS_TEAM_ID, bundle = process.env.IOS_BUNDLE_ID;
  if (!team || !bundle) return NextResponse.json({ applinks: { details: [] } });
  return NextResponse.json({
    applinks: { details: [{ appIDs: [team + '.' + bundle], components: [{ '/': '/', '?': { invite: '?*' }, comment: 'Group invite and shared call links' }] }] },
  }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
