# Rules for anyone changing this app (people, Codex, Claude Code)

This is a **free prediction game between friends**. It must never become, or look like, gambling. That protects the App Store listing, the age rating, and the app's legal position (including in Türkiye). `tests/policy.test.ts` enforces most of this: **never loosen those tests to make a change pass.** If a feature seems to need it, stop and ask the product owner.

## Hard rules for points
- Points are **only earned**, by being right. Nobody spends, chooses, allocates or risks points: every pick counts the same (`PICK_POINTS` = 10 in `lib/rules.ts`). What a right answer is worth is set when picks close, from how the group split (`callPoints` in `lib/rules.ts`): 10 to 40, +10 for a lone call, exact score 30/40, match of the week double. A called-off call counts for nobody. Before the lock, never show points per answer (that would read like odds).
- Points can **never** be bought, sold, gifted, traded, transferred between people, or cashed out.
- **No prizes** of any kind, cash or otherwise, are tied to points or rankings.
- No wallets, balances, top-ups, payments or in-app purchases connected to points.
- Make money only with things unrelated to winning: cosmetics, premium group features, sponsored content. Never by selling points or advantages.
- Every new server action must be added to the reviewed list in `tests/policy.test.ts` after confirming it cannot move points or exchange them for anything.

## Words
Players read **calls, predictions, picks and points**. Never use bet, betting, wager, stake, odds, payout, gamble, jackpot, casino or bookie in anything a player sees: UI, notifications, share cards, error messages, store listing.
Internal code names (`bets`, `stake`, `removeBet`, `/share/bet`) may stay; they're never shown.

| Instead of | Write |
|---|---|
| Add a bet | Add a call |
| Long-term bets | Long-term calls |
| Payout, odds | Score, "bold calls score more" |

## Visuals
No coins, cash, chips, dice, playing cards, slot-machine effects or bank imagery. Celebrations for being right (confetti, trophies, medals) are fine.

## Age rating
Plan for the App Store questionnaire to rate the app **18+** (frequent simulated gambling), and treat 13+ as a bonus. The audience is 18–30, and the product must work at 18+. See `docs/APP_STORE.md`.

## Working on the code
- `npm test` and `npm run typecheck` must pass. `npm run build` checks the web build.
- iOS: see `docs/IOS.md`. CI compiles the app and widget on macOS for every change.
- The product name lives in `lib/brand.ts` (and `appName` in `capacitor.config.ts`).
