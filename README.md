# Calld

A private-group prediction app built with Next.js, React and TypeScript, using embedded PostgreSQL (PGlite). Friends put free confidence points on weekly and long-term calls. It includes result disputes, standings, seasons, football markets, sharing, notifications, and group moderation. No money or prizes are involved.

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

## Deploy on Railway

The app runs as **one service with one volume**. The embedded database is a single-writer file store, so never scale it to more than one replica.

1. In Railway, create a project from this GitHub repo. It builds with the `Dockerfile`; `railway.json` sets the health check (`/api/health`) and turns off deploy overlap.
2. Add a **volume** to the service (any mount path, e.g. `/data`). Railway sets `RAILWAY_VOLUME_MOUNT_PATH` and the database is stored at `<mount>/postgres`. Until a volume is attached, `/api/health` returns 503 in production so a deploy can't go live with data that would be lost.
3. Under the service's networking settings, generate a public domain.
4. Optional variables: `APP_ORIGIN` (if you add a custom domain), `API_FOOTBALL_KEY` (for Football and Mixed groups).
5. Turn on volume backups for the service.

Data written to the volume survives redeploys, restarts and crashes.

## Practice groups (testing)

Set `PRACTICE_GROUPS=1` on the server to show a **Practice group** option when creating a group. Practice groups run the normal rules on a fast clock: the round opens as soon as three people have joined, calls lock within 45 minutes, results can be disputed for 3 minutes, unresolved calls void 10 minutes after their event, standings publish at +50 minutes and the next round opens every hour. Normal groups are never affected, even while the setting is on. Remove the variable to hide the option; existing practice groups keep their fast clock.
