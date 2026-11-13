# 📏 Distance Analyzer

Works as an **installable PWA** and as a **native Android app** (same UI, plus native extras). No server, no account, no tracking - data stays on your device. Hebrew (RTL, default) and English.

**Android APK (always the latest):** `releases/latest/download/distance-analyzer.apk` · **PWA:** `https://ohadsam.github.io/distance_analyzer/` (after enabling Pages, see `docs/RELEASING.md`).

## Features
- Project skeleton only - features are specified by the owner and tracked in `docs/REQUESTS.md`.

## Develop
```bash
npm install
npm run serve        # http://localhost:8080
npm run check && npm test && npm run e2e
```
Android: `gradle -p android assembleDebug` (needs the Android SDK; CI builds it otherwise). Docs: [User guide](docs/USER_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [Releasing & setup](docs/RELEASING.md) · [Changelog](docs/CHANGELOG.md) · [Requests](docs/REQUESTS.md) · [Release checklist](.claude/skills/release-checklist/SKILL.md).
