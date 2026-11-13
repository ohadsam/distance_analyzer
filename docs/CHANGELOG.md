# Changelog

## 0.1.0
- Project skeleton: vanilla-JS PWA (`web/`, no build step, no runtime dependencies) + thin Android WebView shell (`android/`) that packages the same `web/` folder as assets.
- Hebrew (RTL, default) and English; light/dark; offline service worker; CSP `'self'` only.
- Pipeline copied from the sister project (morning_organizer): static + security checks, unit tests, Playwright e2e with axe-core, Android unit tests + lint + signed release APK, GitHub Release `distance-analyzer.apk` on `main`, PWA on GitHub Pages.
- Verified: static checks, unit tests, e2e. Not verified here: the Android build (CI only).
