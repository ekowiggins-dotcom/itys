# Who’ll Pro: setting up the subscription (v1.1)

Groups of up to 4 people are free. Who’ll Pro lets every group someone created have up to 20. How it works in the
app: README.md → “Who’ll Pro”. This page is the App Store Connect side.

## 0. The switch

The server enforces the 4-person free size only when Railway has `PRO_LIMITS=on`. Without it, groups work as in 1.0
(no free-size limit; at most 20 people) and Who’ll Pro appears only inside app builds that can buy it (1.1 and later). So this can be
deployed while 1.0 is in review, tested in TestFlight (purchases, restore), and switched on once 1.1 is approved.
To test pausing in TestFlight before that, turn it on briefly and off again: groups that grew past 4 in the meantime
keep their size for free.

## 1. Products (App Store Connect → your app → Monetization → Subscriptions)

1. Create a **subscription group**, e.g. “Who’ll Pro”. Both products go in this one group, so people can switch
   between monthly and yearly and only ever have one.
2. Add two **auto-renewable subscriptions**:

   | Reference name | Product ID | Duration |
   |---|---|---|
   | Who’ll Pro Monthly | `app.wholl.ios.pro.monthly` | 1 month |
   | Who’ll Pro Yearly | `app.wholl.ios.pro.yearly` | 1 year |

   If you use other ids, set `IAP_PRODUCT_IDS` on Railway to both, comma-separated (monthly first is fine; the app
   shows yearly first).
3. For each: set the **price** (yearly cheaper than 12 × monthly), a **display name** and **description** per
   language (e.g. “Who’ll Pro” / “Groups of up to 20 people”), and a **review screenshot** of the purchase screen
   (Settings → Who’ll Pro in the app; a TestFlight screenshot is fine) with review notes (below).
4. **Introductory offer** on both: Free, 1 week, for new subscribers.
5. Group level: add a localized group display name (“Who’ll Pro”). Leave Family Sharing off unless you want it.
6. Avoid the words bet, wager, stake, odds, payout, gamble, jackpot or casino in any product text.

## 2. Server notifications

App Store Connect → your app → App Information → **App Store Server Notifications**:

- Production URL: `https://itys-production.up.railway.app/api/app-store/notifications`
- Sandbox URL: the same.
- Version: **Version 2**.

Use “Request a Test Notification” (or the App Store Server API) to check it: the server logs a `TEST` notification and
answers 200. Notifications are verified against Apple’s root certificate, so nothing else is needed (no shared secret,
no keys on the server).

## 3. Testing in the sandbox

- TestFlight builds always buy in the sandbox for free; renewals are sped up (a month renews every 5 minutes, a year
  every hour, up to 12 renewals; the free week lasts 3 minutes).
- Sandbox purchases are accepted by the live server (App Review also buys in the sandbox), and stored with
  `environment = 'Sandbox'`.
- To test again from scratch: App Store Connect → Users and Access → Sandbox → Test Accounts → clear purchase
  history, or use a new sandbox Apple ID (Settings → App Store → Sandbox Account on the iPhone).
- Things to try: buy monthly with the free week; make a 5th person join (group link and call invite); cancel in
  Settings → Subscriptions and let it expire (the group pauses, members see “Paused until … renews”); renew;
  **Restore purchases** after deleting and reinstalling the app.

## 4. App Review

- Add both products to the **1.1 version** before submitting (“In-App Purchases and Subscriptions” on the version
  page); the first subscription must be submitted together with an app version.
- The App Review demo account’s group already has 4 people, so the reviewer sees “Free groups have up to 4 people”
  on the group’s Group tab with “Get Who’ll Pro →”. Review note suggestion:

  > Who’ll Pro is an optional auto-renewable subscription for people who create groups of more than 4 friends. To
  > see it: sign in with the demo account, open “App Review demo” → Group tab → “Get Who’ll Pro”, or Settings →
  > Who’ll Pro. “Restore purchases” is on the same screen. Points in the game remain free and can’t be bought.

- The purchase screen shows the price and period from the App Store, the free week, that it renews automatically
  unless cancelled 24 hours before the end, how to cancel, and links to the Terms of Use (`/terms`, which also links
  Apple’s standard EULA) and the Privacy Policy (`/privacy`).
- In the app’s App Store description, add a line such as: “Optional Who’ll Pro subscription for groups of 5–20
  people. Terms: https://itys-production.up.railway.app/terms”.
- App Privacy: add **Purchases → Purchase History** (linked to the user, App Functionality, not tracking).
