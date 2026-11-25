# Who’ll

Friendly predictions between friends. People in a private group make "calls" about plans and life, pick answers before the call locks, and earn free points for being right. No money, no prizes, just bragging rights.

This is a clean rebuild, made step by step:

| Step | What | Status |
|---|---|---|
| 1 | Sign-in (email link), groups, invites | ✅ |
| 2 | Calls and picks (split hidden until lock) | ✅ |
| 3 | Settling, disputes, votes, job runner | ✅ |
| 4 | Scoring and weekly ranking | ✅ |
| 5 | Notifications (outbox) | ✅ |
| 6 | Moderation and reporting | ✅ |
| 7 | Share cards | ✅ |
| 8 | iOS app (Capacitor) and widget | ✅ (builds in CI; not yet run on a device) |
| 9 | Who’ll Pro: subscription for groups of 5+ (v1.1) | ✅ (see docs/SUBSCRIPTIONS.md) |

## Stack

- **Next.js 16** (App Router, server actions) + **React 19** + TypeScript
- **Postgres** via **Drizzle ORM** (`postgres` driver). Migrations live in `drizzle/`.
- **Zod** for input validation, **Vitest** for tests (tests run on an in-memory Postgres via PGlite).

## Run it locally

Needs Node 22+.

```sh
npm install
npm run dev
```

Open http://localhost:3000. With no `DATABASE_URL`, development uses an embedded Postgres (PGlite) stored in `~/.wholl/dev-db`, so there is nothing to set up. Sign-in links are printed in the server console and shown on the page in development.

To try every stage of a call without waiting days, stop the dev server and run `npm run seed:dev`. It creates a "Demo flat" group for `ada@example.com` with calls that are open, waiting for you to settle, open to dispute, in a vote, and settled.

To use a real Postgres instead (recommended once you have Docker running):

```sh
docker run -d --name wholl-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17
echo 'DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres' > .env.local
npm run db:migrate
npm run dev
```

## Checks

```sh
npm test          # unit + database tests
npm run typecheck
npm run lint
npm run build
```

Browser tests (Playwright) check every screen at 320px and 390px wide, light and dark: nothing wider than the screen, every control at least 44px tall, and no serious accessibility problems (axe, WCAG 2.1 AA). They start their own server with a throwaway database:

```sh
npx playwright install chromium   # once
npm run e2e                        # stop `npm run dev` first: two dev servers make each other reload
npm run screenshots                # App Store screenshots (1290×2796) into app-store-screenshots/
```

CI runs all of the above on every push (`.github/workflows/ci.yml`); the browser report and the App Store screenshots are attached to each run.

## Configuration (production)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Required in production. |
| `APP_ORIGIN` | Public URL, e.g. `https://wholl.app`. Required in production; links are never built from the request's Host header. |
| `RESEND_API_KEY` | Sends email (sign-in links for “Use email instead” in the app, alerts) through Resend. Sign in with Apple works without it. |
| `EMAIL_FROM` | Sender, e.g. `Who'll <login@wholl.app>`. |

| `CRON_SECRET` | 16+ random characters. Protects `POST /api/jobs`. |
| `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_KEY`, `IOS_BUNDLE_ID` | Push notifications and universal links for the iOS app (see docs/IOS.md). |
| `SUPPORT_EMAIL` | Contact address shown on `/support` and `/privacy` (needed for App Store review). |
| `OPERATOR_NAME` | Who runs the service, named on the privacy and terms pages. |
| `APPLE_SERVICES_ID` | Not needed: sign-in happens in the iOS app only. Tokens for it are still accepted if set. |
| `APPLE_SIGNIN_KEY`, `APPLE_SIGNIN_KEY_ID`, `APPLE_TEAM_ID` | Optional: lets account deletion revoke Sign in with Apple (see docs/APP_STORE.md). |
| `REVIEW_EMAIL`, `REVIEW_CODE` | App Review sign-in with a code, plus a demo group (see docs/APP_STORE.md). |
| `ERROR_WEBHOOK_URL` | Optional Slack/Discord webhook for server error alerts (errors are always logged as JSON). |
| `APP_STORE_ID` | Optional: the App Store app id for the home page’s “Download for iPhone” button and Safari’s app banner. Default `6831526797`. |
| `PRO_LIMITS` | `on` turns on Who’ll Pro’s group-size limits and shows Pro to everyone. Leave it unset until the 1.1 app is approved (the 1.0 app can’t buy). |
| `IAP_PRODUCT_IDS` | Optional: Who’ll Pro product ids, comma-separated. Default `app.wholl.ios.pro.monthly,app.wholl.ios.pro.yearly`. |
| `RUN_JOBS_IN_PROCESS` | Set to `1` to run the job runner inside the web server (simplest single-service setup). |

Run `npm run db:migrate` before starting a new release.

### Background jobs

Calls move on by time: settlers are chosen when picks close, results become final after 24 hours, votes close, and unsettled calls are called off after 7 days. Pick one way to run this every 30–60 seconds:

- **Worker process:** a second service running `npm run worker` (recommended).
- **Cron:** call `POST /api/jobs` with `Authorization: Bearer $CRON_SECRET` every minute.
- **In process:** `RUN_JOBS_IN_PROCESS=1` on the web service.

Running more than one is safe: each due call is claimed with `FOR UPDATE SKIP LOCKED`. Every user action also applies any overdue step first, so a late job runner never lets someone act on stale state.

## Points and ranking

- A right call scores **10 + 30 × (1 − share of pickers who said the same)**, so 10 to 40. Wrong: 0.
- Called-off calls, cancelled calls, and calls fewer than 2 people picked on count for nobody.
- Scores are written once when a call settles (`scores` table) and can always be rebuilt from calls and picks.
- Rankings (this week, last week, all time) sort by **average points per call picked**, then number right. To be ranked you must pick at least 60% of the calls you could have (all time: at least 5). Calls about you, and calls from before you joined, don't count against you.
- Weeks run Monday 00:00 to Monday 00:00 in the group's time zone.
- Points can't be bought, spent, traded or cashed out, and there are no prizes. `tests/wording.test.ts` keeps gambling words out of the app.

## Sign-in happens in the app

- Sign in with Apple and emailed sign-in links work **only inside the iOS app**. In a web browser, `/login`, invite links (`/join/*`, `/c/*`) and sign-in links show “Get the app” with the App Store link instead, and the sign-in actions refuse. The website is the landing page; existing web sessions keep working.
- The server recognises the app by `WhollApp/` in the user agent (set in `capacitor.config.ts`, builds from 1.1) or by the `wholl_app` cookie, which the page sets as soon as it finds the app’s native bridge (`src/app/AppMarker.tsx`), so the 1.0 build works too. Neither is a security boundary; they decide what to offer.
- Invite and sign-in links are universal links, so on an iPhone with the app they open in the app. Invite pages also carry Safari’s app banner with the invite as `app-argument`.
- Browser tests sign in with the app’s user agent (`tests/e2e`).

## Who’ll Pro (v1.1)

- Groups of up to 4 people are free. A 5th person can join only if the group’s creator has **Who’ll Pro**, an auto-renewing App Store subscription (monthly or yearly, with a free week). One subscription covers every group that person created; everyone else stays free.
- If the creator’s Pro ends, a group with 5+ people is **paused**: no new calls and no new members until they renew. Open calls carry on (picks, settling, disputes), nobody is removed, nothing is deleted. Members see “Paused until <creator> renews”.
- **Switch:** limits only apply with `PRO_LIMITS=on`. Until then groups can grow to 20 without Pro, and Pro is shown only inside app builds that can buy it (1.1+), so the 1.0 app and its review never see it. Groups that grow past 4 while the switch is off keep that size for free.
- Groups made before v1.1 keep the size they had then for free (`groups.free_members`). If the creator leaves or deletes their account, the group’s admin is the one whose Pro counts.
- The iOS app buys with StoreKit 2 (`ios/App/App/SubscriptionsPlugin.swift`) and sends the signed transactions to the server, which checks Apple’s certificate chain and signature (`src/server/storekit.ts`). App Store Server Notifications v2 (`POST /api/app-store/notifications`) keep renewals, expiry, refunds and revocation up to date (`src/server/subscriptions.ts`). Points are never part of it.

## Notifications

- **In the app:** new calls, calls about you, "picks close in 2 hours" (only if you haven't picked), time to settle, a result to check, a vote needed, results with your points, called-off calls, new members. The bell shows the unread count.
- **By email:** only when something needs you (settling, a vote, a call about you). Anyone can switch email off in Settings.
- **No stored text:** notifications are rendered when read, from current names and data, and only for groups you're still in. They never reveal anyone's pick.
- **Transactional outbox:** notifications and emails are saved in the same transaction as the event. The worker claims emails with a 5-minute lease (a crash mid-send gets retried), retries failures with backoff (5 tries), skips emails that are no longer needed (e.g. the call was already settled) and expires anything older than 24 hours.

## Keeping it kind (moderation)

- **Protect first, review after.** The person a call is about can hide it with one tap. Any call is also hidden once 2 members report it. Hidden calls are shown to nobody, their text never appears in notifications, and their clock (reminders, settling) pauses.
- **Review:** the admin decides (restore or remove), unless the admin wrote the call or it's about them; then it's the longest-standing other member. Removed calls are called off and their points are taken back.
- **Blocking** someone hides their calls from you, mutes their notifications to you, and stops them making calls about you. (A call you're settling stays visible so it still gets a result.)
- **Removing members:** the admin can remove someone, who can't rejoin until let back in.
- **Word filter:** explicit words are refused, including common disguises (`src/server/content-filter.ts`). The list is a starter; replace it with a maintained list before launch.
- **Deleting your account** (Settings) removes you everywhere: memberships and names, picks, votes, points, notifications and sign-in links. Calls about you are taken down. Calls you wrote stay, shown as by "Former member". The admin role passes on.

## Sharing

- **Results:** members can share a settled call as a public link (`/r/<token>`) with a preview image for chat apps. It shows the call, the answer, how many picked and how many called it, and the sharer's own result. Never who picked what, other names, or the group's name.
- **Who may share:** a call about someone can only be shared by that person; a "who" call only by the person it named.
- **Always re-checked:** every view re-applies the rules, so a hidden/removed call, the sharer leaving or deleting their account takes the link down.
- **Invites:** invite links get a preview image with the group's name and size (the same as the join page).
- Images are made with `next/og` and the Inter font (Latin + Latin Extended for Turkish letters). Set `APP_ORIGIN` so preview URLs are absolute.

## iOS app

A Capacitor 8 shell around the live site, with push notifications (APNs), a home-screen widget, the native share sheet and universal links. CI builds the app and widget for the simulator on every iOS change. Setup, Apple account steps and server settings: [docs/IOS.md](docs/IOS.md).

## Deploying (Railway)

Live at https://itys-production.up.railway.app (Railway project "reasonable-unity", service `itys`, which deploys every push to `main`).

- **Database:** the project's Postgres service; `DATABASE_URL=${{Postgres.DATABASE_URL}}` on `itys`.
- **Migrations:** `npm start` runs `npm run db:migrate` first (under a Postgres advisory lock), so every deploy has its tables before it serves anything.
- **Background jobs:** `RUN_JOBS_IN_PROCESS=1` runs them inside the web service. To split them out later, add a second service from this repo with start command `npm run worker` and remove that variable.
- **Settings on `itys`:** `APP_ORIGIN`, `EMAIL_FROM`, `IOS_BUNDLE_ID`, `APNS_TEAM_ID`, `APNS_KEY_ID` are set. Secrets you add yourself in the dashboard: `APNS_KEY` (push), and optionally `RESEND_API_KEY` (email sign-in links in the app and alert emails).
- **Health check:** `GET /api/health` (checks the database).
- The service is configured in the Railway dashboard, not by a config file in this repo.

## How a call ends

1. When picks close, a settler is chosen: someone neutral if possible (didn't pick, didn't write it, not the subject).
2. From the event time the settler enters the result, or "call it off". After 48 hours anyone but the subject can.
3. For 24 hours, anyone who picked (except whoever entered the result) can dispute it by naming the right answer.
4. A dispute opens a 24-hour vote among people who picked. More than half of the votes cast decides it. A tie, no majority or fewer than 2 votes calls the call off: nobody scores, so nobody wins by settling first.
5. Nobody entered a result within 7 days: the call is called off.

## Design rules

See [AGENTS.md](AGENTS.md). In short:

- **Security from day one:** sign-in tokens and session tokens are stored only as hashes; sessions expire after 30 days of no use; invite links carry 128 random bits and can be reset; rate limits on sign-in, group creation, joining and invite lookups.
- **No group data for outsiders:** a group you're not in looks exactly like one that doesn't exist. Invite links show only the group's name and size.
- **Unique names per group**, so nobody can join as someone else.
- **Reading a page never writes to the database** (sessions slide forward at most once a day).
