# Releasing & one-time setup

## What the pipeline does
| Trigger | Workflow | Result |
|---|---|---|
| any push / PR | `ci.yml` → *web* + *android* jobs | static+security checks, unit tests, Playwright e2e (axe), Android unit tests, lint, release APK (artifact) |
| push to `main` | `ci.yml` → *release* job | new GitHub Release `build-N` containing `stepup.apk` (marked **latest**, newest 10 kept) |
| push to `main` touching `web/**` | `pages.yml` | PWA published on GitHub Pages |

`main` is the primary branch. Work happens on a branch, CI runs on it, and it is merged to `main`.

## One-time setup (repository owner)
1. **Pages**: Settings → Pages → Source: *GitHub Actions*.
2. **APK signature.** `android/app/stepup.keystore` is committed on purpose, so all builds share one signature and phones update in place. Trade-off: anyone can sign an APK with this key - acceptable for a side-loaded personal app, **not** for the Play Store. To use a private key, add repository secrets `KEYSTORE_BASE64` (`base64 -w0 your.jks`), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`; CI then uses it (switching keys once forces a reinstall).
3. Workflow permissions: Settings → Actions → General → *Read and write permissions* (needed by the release job).

## Shipping a change
Follow `.claude/skills/release-checklist/SKILL.md`. In short: `npm run bump -- patch|minor`, CHANGELOG + user guide, `npm run check && npm test && npm run e2e`, push, watch CI, confirm the release appeared.

## Local development
`npm install && npm run serve` → http://localhost:8080 . Android needs the Android SDK (`dl.google.com`); in restricted sandboxes rely on CI.
