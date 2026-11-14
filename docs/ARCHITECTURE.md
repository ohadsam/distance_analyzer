# Architecture

```
 GitHub     ┌─────────── web/ (single source of UI, no build, no runtime deps) ───────────┐
 Pages ───► │ index.html + CSP('self')   sw.js (offline)   manifest                        │
            │ js/app.js  router ─► ui/*.js   (DOM via h(), text nodes only)                │
            │ util.js, i18n.js (he/en, RTL)                                                │
            │ native.js ── no-op in browsers ───────────────────────────────┐              │
            └───────────────────────────────────────────────────────────────┼──────────────┘
                                                                            ▼ window.DistanceNative
 APK (GitHub Releases, always latest)   android/  MainActivity (WebView on https://appassets.androidplatform.net, assets = ../web)
                                         NativeBridge (the only door from JS into Android; validates every argument)
```

* **One codebase for UI.** The APK has no UI code of its own; Gradle packages `web/` as assets. Native code adds only what browsers cannot do (background work, system integration).
* **Dependency direction.** `ui/* → store/engine/stats/share → util/config`. Logic modules stay **pure** (no DOM, no storage, time passed in as `now`). Web code reaches Android only through `js/native.js`; Android code is reached only through `NativeBridge.kt`. Logic that must also run natively lives in `*Math.kt`-style objects without Android types, with JVM tests.
* **No server.** Data lives on the device (IndexedDB when persistence is added; always with a memory fallback when storage is blocked).
* **Versioning.** `web/version.json` → PWA, service-worker cache name, APK `versionName/Code` (`npm run bump`).
* **Trust boundaries.** (1) Imported/shared/restored data → sanitise + normalise on load. (2) Web → Android → `NativeBridge` argument validation and size caps. (3) CSP `'self'` only + escaped DOM building (`h()`; `innerHTML` & co. are banned by `scripts/static-checks.mjs`).
* **Network.** None. The Android manifest declares no `INTERNET` permission; any new network use needs a written reason here.
* **Permissions.** `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`: workout distance from GPS, read only while a workout is on screen. The WebView's geolocation prompt is answered in `MainActivity` for our own origin only, after Android's runtime permission. The motion sensor (rhythm coach) needs no permission.

## Modules (0.2)
- **Pure, unit-tested:** `geo.js` (haversine, track projection), `workout.js` (fix filtering, distance, moving time, pace, splits, kcal, sanitisers), `cadence.js` (step detector + lock state machine), `metronome.js` (beat times, breathing pattern), `format.js`.
- **Thin, side-effecting:** `audio.js` (look-ahead click scheduler on the Web Audio clock; beat times on `performance.now()` so animation and tests share one clock), `store.js` (IndexedDB + memory fallback, localStorage), `icons.js` (SVG via `createElementNS`).
- **UI:** `ui/workout.js` (GPS watch, wake lock, lock screen, phases; per-second paint touches text only), `ui/rhythm.js` (sensor -> cadence -> metronome + animation), `home/history/settings`.
- **Design data:** `design/momentum/` (ChatGPT kit, source of truth) -> `scripts/build-design.mjs` -> `css/packs.css`, `js/iconData.js` (generated, checked by a test).
- **Rhythm coach state machine:** off -> learning (silent, >= 20 s and steady >= 8 s: steps within 7 % variation, 100-230 spm) -> locked (clicks at the measured cadence). Stop > 5 s or pause -> learning. A different steady cadence (> 6 % away) for 16 s re-locks. Manual rhythm (no sensor / ± buttons) is never replaced by the sensor.

