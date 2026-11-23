<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Who’ll: rules for anyone changing this app

A free social prediction game between friends. Read README.md first.

## Product rules
- Points are only earned by being right. Never bought, spent, staked, traded, gifted or cashed out. No prizes.
- Never show players the words bet, wager, stake, odds, payout, gamble, jackpot or casino, and don't use them in code either.
- Calls about a person must always tag a real member, and that person can hide a call about them immediately.

## Engineering rules
- Business logic lives in `src/server/*` as plain functions that take a `db` and `now`. Pages and server actions stay thin.
- Every function that reads group data checks active membership first (`requireMember`). Outsiders get "not found".
- Visibility of picks and results will be decided in one place (`src/server/visibility.ts`, step 2). Never filter data ad hoc.
- Reading a page must not write to the database.
- Schema changes: edit `src/server/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`.
- `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` must pass.
