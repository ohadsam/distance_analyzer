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
