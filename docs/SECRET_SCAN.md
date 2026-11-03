# Public-review secret scan

Scan date: 2026-11-03. Tool: Gitleaks v8.30.1, downloaded from its official release with the published archive checksum verified. Logs and reports were redacted; secret values are not reproduced here.

## Scope

- Full app source and local files at `/workspace/prediction-app`, including ignored build/dependency files. This source directory had no Git history before preparation.
- Separate preview directory and all six commits reachable from its branches/remotes; reflog and unreachable-object checks identified no additional commits.
- GitHub destination `ekowiggins-dotcom/itys`: its original, non-shallow `main` history consisted of one README-only commit. That history is preserved.
- Provider-specific keys/tokens, generic API keys, database credentials, private keys, service-account credentials, environment files, and secret-bearing source references were checked. Generated files and dependencies were scanned as well. No scanner can guarantee absence of every possible secret format.

## Findings

No hardcoded provider/API credentials, database passwords/URLs, fixed session secrets, private keys or service-account JSON were found in application source or any scanned commit. The only environment file in the original application source was `.env.example`, containing no credential.

The directory scans flagged **16 occurrences of generated Next.js signing/encryption keys** in local, uncommitted build output. These are real framework-generated values, not embedded provider credentials. Every occurrence is listed below; repeated file/line entries indicate distinct keys on the same line. Their commit is “none — local working tree”.

| Source | File | Line | Commit | Handling |
| --- | --- | ---: | --- | --- |
| Full app | `.next/cache/.rscinfo` | 1 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Full app | `.next/prerender-manifest.json` | 94 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Full app | `.next/prerender-manifest.json` | 95 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Full app | `.next/server/preview-props.json` | 3 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Full app | `.next/server/preview-props.json` | 4 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Full app | `.next/server/server-reference-manifest.json` | 4 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Full app | `.next/cache/.previewinfo` | 1 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Full app | `.next/cache/.previewinfo` | 1 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Separate preview | `.next/cache/.rscinfo` | 1 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Separate preview | `.next/cache/.previewinfo` | 1 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Separate preview | `.next/cache/.previewinfo` | 1 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Separate preview | `.next/server/preview-props.json` | 3 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Separate preview | `.next/server/preview-props.json` | 4 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Separate preview | `.next/server/server-reference-manifest.json` | 1 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Separate preview | `.next/prerender-manifest.json` | 94 | None — local working tree | Excluded from public source; `.next/` ignored. |
| Separate preview | `.next/prerender-manifest.json` | 95 | None — local working tree | Excluded from public source; `.next/` ignored. |

No secret was found in past commits, so the stop-before-push condition was not triggered. No history was rewritten. Local build artifacts were not imported into the GitHub checkout; builds regenerate framework keys. No production provider credential was present to revoke or replace. The API-Football credential is already read from a server environment variable. `.env.example` now contains blank placeholders only.

## Existing commits checked

GitHub destination:

- `128ba6ed77719395a3b89e59aab43aa869b5ae41` — initial README.

Separate preview:

- `2d9e25d830f9e9c7f91a7fa8d79bdcee2f8a555b`
- `36217dab72f53ef722a63a88d01dba3f326974e3`
- `b5e983d5fed363ebe529d0f4eaa8a85e6f85875c`
- `3b87d6373889e8f613bac1e662bff7afebda9e4e`
- `5e488d44c26ffb88f9d529a8adc3afaef6d2aff0`
- `397fbc81aa74afa43e045b1a0cac806eb267ac22`

## Repository hygiene

The public checkout includes the full application, lockfile, migrations, tests and font licenses. It excludes local databases, dependency folders, build output, logs and populated environment files. Its README lists server variable names without credential values. The separate Sites checkout, hosting identifiers and deployment archives are not imported.

## Validation of the prepared checkout

A clean `npm ci`, `npm test`, `npm run typecheck` and `npm run build` passed. Ignore-rule checks cover populated environment files, dependencies, build output, logs and local database formats; the blank `.env.example` remains includable. The prepared source directory scan found zero leaks before dependency installation. Generated build keys remain excluded from Git.
