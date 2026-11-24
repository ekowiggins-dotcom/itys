import { NextResponse } from "next/server";

/**
 * Served at /.well-known/apple-app-site-association (see next.config.ts). Tells iOS which links open the app:
 * sign-in links, invites, groups and shared results. Needs APNS_TEAM_ID (or APPLE_TEAM_ID) and IOS_BUNDLE_ID.
 */
export function GET() {
  const team = process.env.APPLE_TEAM_ID ?? process.env.APNS_TEAM_ID;
  if (!team) return NextResponse.json({ error: "not configured" }, { status: 404 });
  const appID = `${team}.${process.env.IOS_BUNDLE_ID ?? "app.wholl.ios"}`;
  return NextResponse.json({
    applinks: {
      details: [
        {
          appIDs: [appID],
          components: [{ "/": "/auth/verify*" }, { "/": "/join/*" }, { "/": "/groups/*" }, { "/": "/r/*" }, { "/": "/c/*" }, { "/": "/notifications" }],
        },
      ],
    },
    webcredentials: { apps: [appID] },
  });
}
