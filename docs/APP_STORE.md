# App Store submission notes

## URLs

| Field | Value |
|---|---|
| Privacy Policy URL | `https://<your domain>/privacy` |
| Support URL | `https://<your domain>/support` (set `SUPPORT_EMAIL` so it shows a contact address) |
| Marketing URL (optional) | `https://<your domain>/` |

## Sign in with Apple

The iOS app signs people in with **Sign in with Apple** only. Requirements (the old app's identifiers already had these enabled; check they still do):

- App ID `app.wholl.ios` has the **Sign in with Apple** capability (the app's entitlements request it; the TestFlight workflow makes profiles that include it).
- Optional, recommended: a **Sign in with Apple key** (Keys → +, enable Sign in with Apple; one key can also have APNs). Set `APPLE_SIGNIN_KEY` (the .p8 contents), `APPLE_SIGNIN_KEY_ID` and `APPLE_TEAM_ID` in Railway. With it, deleting an account also revokes the app's access at Apple, as Apple asks for apps using Sign in with Apple.
- Website: sign-in happens only in the iOS app. In a browser, /login, invite links and sign-in links show “Get the app” (App Store link) instead. The server knows the app by `WhollApp/` in the user agent (1.1+) or by the `wholl_app` cookie the page sets when it finds the app’s native bridge (1.0). See `src/lib/app-client.ts`.

## Who'll Pro (subscription, from 1.1)

See [SUBSCRIPTIONS.md](SUBSCRIPTIONS.md) for the products, the notifications URL and the review notes.

## App Review access

Reviewers can simply use **Sign in with Apple** with their own Apple ID, but they'd land in an empty account. To give them a ready-made group: In Railway, set on the web service:

- `REVIEW_EMAIL`: e.g. `review@<your domain>` (any address; it never receives mail)
- `REVIEW_CODE`: 16+ random characters

On the next start the app creates an **"App Review demo"** group for that account, with three demo friends, open calls to pick on, and a settled call the reviewer got right. In App Store Connect → App Review Information, enter:

> Sign in: on the sign-in screen open "Use email instead", enter `<REVIEW_EMAIL>`, open "Have a sign-in code?", enter `<REVIEW_CODE>`, then tap Send link. You'll land in a demo group with friends and calls. (Sign in with Apple also works, with an empty account.)

You can remove both variables after approval.

## App Privacy ("nutrition label")

Data **linked to the user**, used for **App Functionality** only, **not** used for tracking:

| Apple category | What |
|---|---|
| Contact Info → Email Address | only if the person shares it via Sign in with Apple (often a private relay address) |
| Contact Info → Name | the name friends see |
| User Content → Other User Content | calls, picks, results, votes, reports |
| Identifiers → User ID | account id |
| Identifiers → Device ID | push token (only if notifications are allowed) |
| Purchases → Purchase History | Who'll Pro subscription: plan, transaction ids, renewal and expiry dates (from 1.1) |

Not collected: location, contacts, browsing history, financial info (payment happens at Apple), health, diagnostics/analytics, advertising data. No tracking.

## Age rating

Answer the questionnaire honestly:

- **Simulated Gambling: None.** Points are free, only earned by being right, can't be bought, spent, traded or cashed out, and there are no prizes (see `AGENTS.md`; `tests/wording.test.ts` keeps gambling words out of the app).
- **User-generated content: Yes** (calls written by friends in private groups). This requires, and the app has:
  - a filter for objectionable text (`src/server/content-filter.ts`, English + Turkish lists),
  - one-tap hiding for the person a call is about, and reporting for everyone,
  - blocking,
  - review of reported content by the group admin (or another member when the admin is involved),
  - published contact information (`/support`).

Expect **12+** (infrequent mild mature themes from user content); the app's terms say it isn't meant for under-13s.

## Other checks

- Sign in with Apple is the app's only sign-in, so Apple's rule to offer it alongside other social logins is met.
- Account deletion is in the app: Settings → Delete account.
- Push notifications are optional and asked for in context.
- Run the **TestFlight** workflow for each build (Actions → TestFlight → Run workflow).
- App Store screenshots (1290×2796) come from `npm run screenshots` and are attached to each CI run.

These pages and notes were written carefully but aren't legal advice: have the privacy policy and terms checked for the countries you launch in.
