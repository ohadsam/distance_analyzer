# Testing and quality gates

## Commands
`npm run check` (syntax, banned APIs, CSP/SW consistency) · `npm test` (node:test unit tests: logic, i18n parity, version sync, changelog, docs file map, guide titles he/en) · `npm run e2e` (Playwright smoke: boot, RTL, flows, axe-core over every screen/dialog in he+light and en+dark, 320 px no horizontal scroll; `ONLY="step name"` runs one step) · `tests/e2e/journey.mjs` (screenshots of ~90 screens + audit; `GUIDE_DIR=...` regenerates guide images) · Kotlin: JVM unit tests only in CI.
Run long jobs in the background, wait with `until grep ... log`; never edit served web files during a run; Playwright is preinstalled (do not `playwright install`).

## Rules
* New logic => unit test written with it; new flow => e2e step; every fixed bug => regression test; axe stays at ZERO; look at screenshots of every changed screen in he **and** en.
* Native features cannot be exercised in the sandbox: use a **fake bridge stand-in** (`fakeAndroid` in e2e: stubs `NativeBridge` methods + dispatches `permissions-changed`/update events) to test the web side of native flows; say clearly what remains phone-only.
* Layout sweep / text-fit (from SonRise: `tests/e2e/layout.mjs`, `textfit.mjs`, 320-1366 px, big text) once the UI grows.
* Docs test enforces that every web/script/test/Android file is listed in `docs/CONTEXT.md`.

## Gotchas (real)
* `page.addInitScript` applies on the next load - seed once with `localStorage` null checks (re-seeding on every navigation broke a toggle-and-reload step); `reload()` first.
* Install the Playwright fake clock BEFORE init scripts that use timers; CSP forbids `addScriptTag` (use `evaluate`); wait for async redraws; continuously animated elements are never "stable" - use `reducedMotion: 'reduce'`.
* axe: `role="listitem"` rows inside `role=list`; tinted chip backgrounds for contrast; unique DOM ids.
* Flex/grid children need `min-width:0` (time inputs/long words widen sheets); `el.replaceChildren(null)` prints "null" - use `setChildren()`/`h()`.
* A bad import in a new module fails e2e at boot: `node -e "import('./web/js/x.js')"`.
* Squashed text in narrow flex columns (blocked-permission note) - put notes under the row text.
