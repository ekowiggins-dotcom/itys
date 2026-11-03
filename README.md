# Sidebet

A private-group prediction app built with Next.js, React and TypeScript, using embedded PostgreSQL (PGlite). Friends stake free confidence points on weekly and long-term bets. It includes result disputes, standings, seasons, football markets, sharing, notifications, and group moderation. No money or prizes are involved.

## Install and run

Use Node.js 22 or newer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Create a group and invite at least two other members. Production: `npm run build` followed by `npm start`.

## Environment variables

No environment variables are required for local Friends groups. Optional server variables (names only):

- `API_FOOTBALL_KEY` — required to enable live football; verify current-season provider access.
- `APP_ORIGIN` — canonical origin for sharing links.
- `PREDICTION_DATA_DIR` — persistent database directory.

Never commit populated environment files or expose the football key to browser code. Sessions are generated at runtime and stored in the database; there is no static session secret to configure.

## Tests

```sh
npm test
npm run typecheck
```

The scheduler runs inside the Node server. Only one process may own the embedded database, which needs persistent writable storage. This MVP does not provide multi-instance database hosting, native push delivery, or a staffed moderation service. Guest account access depends on the session cookie.

Trusted operator tools: `node --import tsx scripts/moderation.ts queue`. Stop the web server before accessing the same database with the CLI.

See [the secret scan report](docs/SECRET_SCAN.md) for public-review findings and scope.
