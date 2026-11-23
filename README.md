# Who’ll

Friendly predictions between friends. People in a private group make "calls" about plans and life, pick answers before the call locks, and earn free points for being right. No money, no prizes, just bragging rights.

This is a clean rebuild, made step by step:

| Step | What | Status |
|---|---|---|
| 1 | Sign-in (email link), groups, invites | ✅ |
| 2 | Calls and picks (split hidden until lock) | next |
| 3 | Settling, disputes, votes, job runner | |
| 4 | Scoring and weekly ranking | |
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

Run `npm run db:migrate` before starting a new release.

## Design rules

See [AGENTS.md](AGENTS.md). In short:

- **Security from day one:** sign-in tokens and session tokens are stored only as hashes; sessions expire after 30 days of no use; invite links carry 128 random bits and can be reset; rate limits on sign-in, group creation, joining and invite lookups.
- **No group data for outsiders:** a group you're not in looks exactly like one that doesn't exist. Invite links show only the group's name and size.
- **Unique names per group**, so nobody can join as someone else.
- **Reading a page never writes to the database** (sessions slide forward at most once a day).
