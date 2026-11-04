# iOS app

The iOS app is a Capacitor shell around the same screens as the web app. The screens are **bundled inside the app** (`native-www/`) and only talk to the server for data.

Native features:
- **Push notifications** for round opens, lock reminders, results and judgment requests (APNs, sent by the server's scheduler).
- **Haptics** when you lock in a pick, switch tabs, or win the week.
- **Native share sheet** with the share-card image attached.
- **Home-screen and lock-screen widget**: your rank, picks left and a live countdown to the next lock.
- **Universal links**: invite links shared in WhatsApp open the app when it's installed.

Every change to `ios/`, `app/` or `lib/` is compiled on a GitHub-hosted Mac by `.github/workflows/ios.yml` (simulator build, unsigned), so native code is checked without a Mac.

## One-time Apple setup

1. Join the Apple Developer Program.
2. Create an **App ID** with bundle ID `app.calld.ios` (or your own) and enable **Push Notifications**, **App Groups**, **Associated Domains** and **Sign in with Apple**. Create App Group `group.app.calld.ios`.
3. Create a second App ID `app.calld.ios.widget` with the same App Group.
4. **Sign in with Apple on the web:** Identifiers → + → **Services IDs**, e.g. `app.calld.web`. Enable Sign in with Apple, choose the App ID above as primary, and add your web domain (e.g. `itys-production.up.railway.app`) and return URL `https://<that domain>/`.
5. Create an **APNs key** (Keys → +, Apple Push Notifications service). Download the `.p8` once and note its Key ID and your Team ID.

## Server settings (Railway variables)

| Variable | Value |
|---|---|
| `APNS_TEAM_ID` | Your 10-character Team ID |
| `APNS_KEY_ID` | The APNs key's ID |
| `APNS_KEY` | The full contents of the `.p8` file (newlines may be written as `\n`) |
| `IOS_BUNDLE_ID` | `app.calld.ios` |
| `APPLE_SERVICES_ID` | The Services ID from step 4, e.g. `app.calld.web`. Shows the Sign in with Apple button on the web |
| `APP_STORE_URL` | The app's App Store link, once it's live. After saving with Apple on the web, people go straight there |

**Sign in with Apple** keeps one account across the web and the app: someone picks from a link on the web, saves with Apple, installs the app, signs in with Apple again, and their group and pick are there. The server checks Apple's token for either the Services ID (web) or `IOS_BUNDLE_ID` (app).

Universal links read `APNS_TEAM_ID` (or `APPLE_TEAM_ID`) and `IOS_BUNDLE_ID`, and are served at `/.well-known/apple-app-site-association`.

## Build on a Mac

```sh
npm ci
API_BASE=https://your-app.up.railway.app npm run ios:sync      # add APNS_ENV=sandbox for builds run from Xcode
SIDEBET_LINK_DOMAIN=your-app.up.railway.app node scripts/ios-setup.mjs
npx cap open ios
```

In Xcode, select your Team for both the **App** and **SidebetWidget** targets, then run on your iPhone. Builds run from Xcode use the APNs sandbox; App Store and TestFlight builds use production.

If you use a different bundle ID, set `IOS_BUNDLE_ID` for both the build commands and the setup script; the App Group becomes `group.<bundle id>`.

## TestFlight without a Mac

`.github/workflows/testflight.yml` builds, signs and uploads the app from a GitHub-hosted Mac.

1. **App Store Connect → Apps → +:** create the app (bundle ID `app.calld.ios`, name Calld). The App IDs and App Group from *One-time Apple setup* must exist first.
2. **Users and Access → Integrations → App Store Connect API → +:** create a key with the **Admin** role, so Xcode can create signing certificates and profiles in the cloud. Download the `.p8` once; note the Key ID and Issuer ID.
3. **GitHub → Settings → Secrets and variables → Actions:**
   - Secrets: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (the whole `.p8` file, including the BEGIN/END lines).
   - Variables: `API_BASE` (your server, e.g. `https://your-app.up.railway.app`) and `LINK_DOMAIN` (the same host without `https://`).
4. **Actions → TestFlight → Run workflow.** Each run uploads a new build numbered after the run. Pushing a tag like `ios-v1.0.1` also starts one.
5. **App Store Connect → TestFlight:** the build appears after processing (about 10–30 minutes). Add yourself under *Internal Testing* to install it right away with the TestFlight app. For friends, create an *External Testing* group with a public link; Apple reviews the first external build before the link works.

Builds declare no non-exempt encryption (`ITSAppUsesNonExemptEncryption = false`; the app only uses HTTPS), so no export-compliance question is asked per build.
