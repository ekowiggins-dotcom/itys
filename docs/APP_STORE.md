# App Store submission notes

## URLs

| Field | Value |
|---|---|
| Privacy Policy URL | `https://<your domain>/privacy` |
| Support URL | `https://<your domain>/support` (set `SUPPORT_EMAIL` so it shows a contact address) |
| Marketing URL (optional) | `https://<your domain>/` |

## App Review access

Reviewers can't receive sign-in emails. In Railway, set on the web service:

- `REVIEW_EMAIL`: e.g. `review@<your domain>` (any address; it never receives mail)
- `REVIEW_CODE`: 16+ random characters

On the next start the app creates an **"App Review demo"** group for that account, with three demo friends, open calls to pick on, and a settled call the reviewer got right. In App Store Connect → App Review Information, enter:

> Sign in: on the sign-in screen enter `<REVIEW_EMAIL>`, open "Have a sign-in code?", enter `<REVIEW_CODE>`, then tap Send link. You'll land in a demo group.

You can remove both variables after approval.

## App Privacy ("nutrition label")

Data **linked to the user**, used for **App Functionality** only, **not** used for tracking:

| Apple category | What |
|---|---|
| Contact Info → Email Address | sign-in |
| Contact Info → Name | the name friends see |
| User Content → Other User Content | calls, picks, results, votes, reports |
| Identifiers → User ID | account id |
| Identifiers → Device ID | push token (only if notifications are allowed) |

Not collected: location, contacts, browsing history, purchases, financial info, health, diagnostics/analytics, advertising data. No tracking.

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

- Sign in with Apple isn't required: the app uses its own email sign-in only, no third-party logins.
- Account deletion is in the app: Settings → Delete account.
- Push notifications are optional and asked for in context.
- Run the **TestFlight** workflow for each build (Actions → TestFlight → Run workflow).
- App Store screenshots (1290×2796) come from `npm run screenshots` and are attached to each CI run.

These pages and notes were written carefully but aren't legal advice: have the privacy policy and terms checked for the countries you launch in.
