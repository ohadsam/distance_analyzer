# Architecture

```
 GitHub     ┌─────────── web/ (single source of UI, no build, no runtime deps) ───────────┐
 Pages ───► │ index.html + CSP('self')   sw.js (offline)   manifest                        │
            │ js/app.js  router ─► ui/*.js   (DOM via h(), text nodes only)                │
            │ util.js, i18n.js (he/en, RTL)                                                │
            │ native.js ── no-op in browsers ───────────────────────────────┐              │
            └───────────────────────────────────────────────────────────────┼──────────────┘
                                                                            ▼ window.StepUpNative
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

## Network (0.4) - the only internet use in the app
`weatherApi.js` makes ONE kind of request: `GET https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&hourly=..` (hourly temperature, apparent temperature, rain probability and amount, wind, UV, is_day). Why: recommendations by weather (owner's request). Safeguards: opt-in (`onlineWx`, off by default, consent card + Settings), coordinates rounded to 2 decimals, nothing else sent, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, 8 s timeout, 200 KB cap, 1 h cache (`da.wxc`), response normalised in `forecast.js` (finite clamped numbers only, at most 72 hours), CSP `connect-src 'self' https://api.open-meteo.com`, Android `INTERNET` (no cleartext, WebView still loads only our own origin). "Forget my location" clears the opt-in, the location, the cache and the notification setting. The service worker never touches cross-origin requests. Open-Meteo data is CC BY 4.0 and free for non-commercial use: keep the attribution and the request volume low (cache).

## Recommendations (0.4)
`reco.js` is pure: `comfort(hour, kind)` -> score + reasons/problems; `routineProfile(rows, now)` -> habit(weekday, hour) 0..1, sessions per day, typical minutes (needs >= 5 workouts, else the weather decides alone); `recommend(forecast, profile, kind, now, {tomorrow})` -> hours + items (habit / best / avoid, neighbouring bests merged); `generalRecs(ctx)` -> effort/steps/routine recommendations as i18n keys. `ui/reco.js` holds the consent card, screen, `mountReco` (shared with the dashboard drill-down) and the widget summary (saved forecast only: the dashboard never uses the network). `reminderLoop.js#recoPart` sends the optional notification (<= 45 min before a habit window with score >= 60, once per slot per day).

## Modules (0.3 additions)
- **Pure, unit-tested:** `stats.js` (filter, buckets by day/week with Sunday start, streak, bests, weather buckets), `steps.js` (estimate, quality factor, series, recommendation), `effort.js` (effort minutes, weekly target = median of recent weeks + gentle raise, `checkWorkout` deviation check, `weekStatus`), `reminders.js` (sanitise, `dueReminders`, `smartNudge`), `alerts.js` (inbox model; keys + params so alerts follow the language), `search.js` (normalise he/en, index, rank).
- **Thin:** `reminderLoop.js` (30 s timer -> pure decisions -> `ui/notify.js` -> inbox + Notification API), `charts.js` (SVG), `brand.js`.
- **Dashboard:** `ui/dashboard.js` holds the widget table `W` (`summary` for the grid, `detail` for the drill-down), the saved layout/filter (validated against known ids), and a draw-sequence guard so only the newest async draw paints. Filters apply to distance/pace/weather/records; effort, steps and consistency always use all history.
- **Alert flow:** workout saved -> `ui/workout.js#effortCheck` -> `effort.checkWorkout(record, history before it)` -> `pushAlert` (inbox + system notification) -> shown on the summary and in `#/alerts`; "raise the bar" writes `barOv` (one week) which `weeklyTarget(..., override)` honours.
- **Search:** `ui/search.js#buildItems` builds items (settings/screens/widgets/workouts/alerts, with both-language keywords); settings results go to `#/settings/<field id>` which scrolls to and focuses the field.
- **Network:** still none. Weather by hand only; automatic weather and maps wait for decision D1.
- **Notifications:** web Notification API while the page is open; background delivery on Android (alarms/foreground service) is not built yet.

## Modules (0.2)
- **Pure, unit-tested:** `geo.js` (haversine, track projection), `workout.js` (fix filtering, distance, moving time, pace, splits, kcal, sanitisers), `cadence.js` (step detector + lock state machine), `metronome.js` (beat times, breathing pattern), `format.js`.
- **Thin, side-effecting:** `audio.js` (look-ahead click scheduler on the Web Audio clock; beat times on `performance.now()` so animation and tests share one clock), `store.js` (IndexedDB + memory fallback, localStorage), `icons.js` (SVG via `createElementNS`).
- **UI:** `ui/workout.js` (GPS watch, wake lock, lock screen, phases; per-second paint touches text only), `ui/rhythm.js` (sensor -> cadence -> metronome + animation), `home/history/settings`.
- **Design data:** `design/momentum/` (ChatGPT kit, source of truth) -> `scripts/build-design.mjs` -> `css/packs.css`, `js/iconData.js` (generated, checked by a test).
- **Rhythm coach state machine:** off -> learning (silent, >= 20 s and steady >= 8 s: steps within 7 % variation, 100-230 spm) -> locked (clicks at the measured cadence). Stop > 5 s or pause -> learning. A different steady cadence (> 6 % away) for 16 s re-locks. Manual rhythm (no sensor / ± buttons) is never replaced by the sensor.

