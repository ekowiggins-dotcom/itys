# App Store plan: age rating and review

Goal: get approved without the app being treated as gambling, and be fine even if Apple rates it 18+.

## What the app is (use these words everywhere)
A free prediction game for friend groups. Each week friends make calls on football and on each other. There is nothing to spend: being right earns points, and bold calls (fewer friends agreeing) earn more; the weekly winner gets bragging rights. **No money, no purchases, no prizes, no cash-out.**

## Age rating

As far as we could find (third-party summary, check Apple's current questionnaire before submitting), the tiers are 4+, 9+, 13+, 16+ and 18+. "Simulated gambling" answered *infrequent* leads to 13+, *frequent* leads to 18+.

Plan:
- **Answer honestly.** Putting points on outcomes looks like simulated gambling even when the points are free, so expect reviewers to call it that. If in doubt, answer *frequent* and accept **18+**. The audience is 18–30, so 18+ costs little, while a rating Apple later disputes can cost an update or a removal.
- **The product already works at 18+:** the web app and invite links say players must be 18 or older, and nothing is designed for children.
- **User-generated content** (custom calls) doesn't raise the rating by itself, but Apple's UGC guideline requires filtering, reporting and blocking. All three are built.

## Before submitting
- [ ] Final name without "bet" (set in `lib/brand.ts` and `capacitor.config.ts`).
- [ ] In-app account deletion (required for apps with accounts).
- [ ] Terms of use and privacy policy pages, with a contact email, linked in the app and the listing.
- [ ] Lawyer's check of the free-points model in the launch country.
- [ ] Push, haptics, share sheet and widget working on a real device (the native features that make it more than a website).

## Store listing rules
- Name, subtitle, keywords and description use *predictions, calls, friends, leaderboard*. Never *bet, betting, odds, wager, gamble, casino, win money*.
- Screenshots show friends, picks, the weekly winner and the widget. No points totals presented like a balance, no coin or chip imagery.
- Category: Games → Trivia or Social, or Social Networking. Not Casino, not Sports betting.

## Notes for the reviewer (paste into App Review notes)
> This is a free social prediction game for private friend groups. Players never spend or allocate points: they make predictions, and correct predictions earn points (more when fewer friends agreed). Points cannot be purchased, sold, transferred, redeemed or exchanged for anything, and there are no prizes. The app contains no in-app purchases and no real-money features. Groups are private and invite-only; custom predictions can be reported, blocked and removed by the group admin.
>
> Demo group invite: <add a demo invite link and two test accounts>
