# Android WebView shell (reference implementation: StepUp `android/`, `web/js/native.js`, `permissions.js`)

Generic for any app: §1-4 and §7-8 apply to every app with an Android shell; §5 (background) and §6 (widgets) are optional modules - include them only if the product needs them. Names like `trackStart`, `StepStore`, `TrackingService` are StepUp's instance of "a user-started activity that must keep running"; rename for your domain. Permission names in `PermMath.NAMES` are the app's own list (location/notifications/activity/battery/install in StepUp; contacts/calendar/SMS/exact-alarms/camera/storage elsewhere).

## 1. Layout and the one door
`MainActivity` hosts the WebView (assets via `WebViewAssetLoader` on an in-app origin; only that origin loads in the WebView, others open in the browser; file/content access off; no cleartext). `NativeBridge` is the **only** JS interface: every argument validated, sizes capped (`BridgeLimits`). Web code reaches it only through `web/js/native.js` (wrappers that are no-ops/`false` in a browser, `native.available` gate). Native events go back through one `deliver(json)` channel (`onNativeEvent`). Anything unit-testable is a pure Kotlin `object` with no Android types (`*Math.kt`) + a JVM test in `src/test` (StepMath, TrackingMath, NotifyMath, WidgetMath, BackupMath, PhotoMath, PermMath, UpdateMath, BridgeLimits, FixBuffer, SplitTracker).
Gotcha: after deleting "dead" bridge methods, grep each helper name (`trackStart` still used `notificationPermission()`; CI caught it).

## 2. Manifest hygiene
Every permission has a one-line comment saying why. Receivers/services `exported=false` unless the system must bind them. `allowBackup` thought through (`data_extraction_rules.xml`). Alarms inexact on purpose (no `SCHEDULE_EXACT_ALARM`) unless the product is an alarm clock. Strings in `values/` and `values-he/` (apostrophes escaped; no U+FEFF; glyphs like ‹ › do not mirror in RTL - use strings).

## 3. Permissions UX (owner's request, StepUp 0.24)
* **State model** (`PermMath.state(granted, askedBefore, rationale)`): `granted | ask | blocked | unsupported`. `blocked` = asked before and Android will not show the dialog (no rationale); the "asked" flag lives in SharedPreferences and is cleared when granted. Names whitelisted in `PermMath.NAMES` (`location, notifications, activity, battery, install`).
* **Bridge**: `permissionState()` JSON, `requestPermission(name)` (system dialog, or the app's settings screen when blocked; battery -> `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`; install -> `ACTION_MANAGE_UNKNOWN_APP_SOURCES`), `openAppSettings()`.
* **Event**: `permissions-changed` is sent after every dialog result, when nothing needed asking (never leave the page waiting), and on `onResume` (person returns from system settings). JS `onPermissionsChanged` debounces (120 ms trailing); in a browser it also listens to `visibilitychange` and the Permissions API.
* **Web** (`permissions.js`): `permissionList()` merges native + browser sources into rows `{id, state, required}`; `requestPermission(id)` waits for the event (<= 60 s). UI (`ui/permissions.js`): Settings section = one row per permission (state chip text + colour not colour-only, **Allow** or **Open settings** button, optional ones like battery marked), plus the start-up **sheet**: shown once per session when a *required* permission is missing, never over a running workout (re-check after the async read), buttons "Allow all / Not now / Do not ask again" (`permAsk` pref), asks right inside the sheet.
* Automatic features follow permissions: location is refreshed by itself (rounded, 6 h freshness, 30 min failure backoff) **only after** the permission is granted; nothing prompts on its own.
* Tests: pure unit tests (list rules, states, defaults, refresh), e2e on a fake Android bridge stand-in + a browser run, axe on the sheet and section. Real dialogs: phone only - say so.

## 4. In-app update that installs as an UPDATE
* Page may only pass a URL that `UpdateMath.validUrl` accepts: `https://github.com/<owner>/<repo>/releases/(latest/download|download/<tag>)/<app>.apk`; `.sha256` next to it.
* `Updater.start(ctx,url)` (own thread): `canRequestPackageInstalls` (else event `need-permission`, page sends the person to the install-unknown-apps screen once and continues on return) -> fetch `.sha256` (2 KB cap) -> download (HTTPS, 80 MB cap, timeouts, progress events every 4 %) -> verify SHA-256, package name, `versionCode` strictly higher, same signing certificates -> `PackageInstaller` session `MODE_FULL_INSTALL` (`USER_ACTION_NOT_REQUIRED` on API 31+ for updates), `PendingIntent.FLAG_MUTABLE` to `InstallReceiver` (handles `STATUS_PENDING_USER_ACTION` by starting the confirm intent, success, failure). Reasons: url, http, size, checksum, invalid, package, same, signature, install, failed - each explained in he/en with a manual download link.
* Manifest: `REQUEST_INSTALL_PACKAGES`, `<receiver .InstallReceiver exported=false>`.
* **Update guarantee (every app)**: same `applicationId` forever; same signing key forever (committed key shared by debug+release, never rotate; CI secrets must not silently switch it); `versionCode` strictly increasing; data untouched (Room: migration per schema change; DataStore/prefs keys only added). Trust model: Android refuses a different signer; the committed key means checksum protects against corruption/mix-ups, not against someone holding the key - document it.
* Only testable on a phone once a **newer** version than the installed one exists.

## 5. Background work
Foreground service for an activity the user started (visible notification, stops itself after a cap), fixes appended to a bounded file and drained by the page (`FixBuffer`), screen-off tracking; step counter sensor sampled by an hourly inexact alarm into `StepStore`; reminders/recommendations as one `setAndAllowWhileIdle` alarm for the next item + `BootReceiver` to re-arm; page work pauses while `document.hidden`. Battery: adaptive GPS rate, no wake locks outside an activity, no polling. Location permission requested by the native side when tracking starts (returns false until granted; the page retries).

## 6. Widgets
`AppWidgetProvider` per widget + shared `Widgets.updateAll`; RemoteViews only (TextView + ProgressBar), no custom drawing/network/permissions; data = live sensor values + a validated JSON snapshot from the page (`setWidgetData` -> `WidgetMath.parse` -> prefs); updates on new reading, new snapshot and `updatePeriodMillis`; tap sends `MainActivity` an `href` extra (same route channel as notifications). Backgrounds from the design kit. Launcher behaviour is "pending device verification" in the docs.

## 7. Signing, versions, CI
Gradle reads `web/version.json`. Committed `<app>.keystore` for debug + release (sideload personal apps; not Play-ready - Play needs `KEYSTORE_*` secrets and a one-time reinstall). R8/shrink optional. Lint is enforcing (`abortOnError`). The APK asset name is fixed (`<app>.apk`) because the updater and README links depend on it.

## 8. What the sandbox cannot do
No Android SDK: Kotlin compile/tests/lint only in CI. Mark in the report: real permission dialogs, notification timing, widgets in a real launcher, installer, real downloads, background tracking with screen off.
