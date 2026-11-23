# Who’ll

Friendly predictions between friends. People in a private group make "calls" about plans and life, pick answers before the call locks, and earn free points for being right. No money, no prizes, just bragging rights.

This is a clean rebuild, made step by step:

| Step | What | Status |
|---|---|---|
| 1 | Sign-in (email link), groups, invites | ✅ |
| 2 | Calls and picks (split hidden until lock) | ✅ |
| 3 | Settling, disputes, votes, job runner | ✅ |
| 4 | Scoring and weekly ranking | next |
| 5 | Notifications (outbox) | |
| 6 | Moderation and reporting | |
| 7 | Share cards | |
| 8 | iOS app (Capacitor) and widget | |

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

CI runs all four on every push (`.github/workflows/ci.yml`).

## Configuration (production)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Required in production. |
| `APP_ORIGIN` | Public URL, e.g. `https://wholl.app`. Required in production; links are never built from the request's Host header. |
| `RESEND_API_KEY` | Sends sign-in emails through Resend. Required in production. |
| `EMAIL_FROM` | Sender, e.g. `Who'll <login@wholl.app>`. |

| `CRON_SECRET` | 16+ random characters. Protects `POST /api/jobs`. |
| `RUN_JOBS_IN_PROCESS` | Set to `1` to run the job runner inside the web server (simplest single-service setup). |

Run `npm run db:migrate` before starting a new release.

### Background jobs

Calls move on by time: settlers are chosen when picks close, results become final after 24 hours, votes close, and unsettled calls are called off after 7 days. Pick one way to run this every 30–60 seconds:

- **Worker process:** a second service running `npm run worker` (recommended).
- **Cron:** call `POST /api/jobs` with `Authorization: Bearer $CRON_SECRET` every minute.
- **In process:** `RUN_JOBS_IN_PROCESS=1` on the web service.

Running more than one is safe: each due call is claimed with `FOR UPDATE SKIP LOCKED`. Every user action also applies any overdue step first, so a late job runner never lets someone act on stale state.

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
