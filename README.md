# 📏 StepUp

Works as an **installable PWA** and as a **native Android app** (same UI, plus native extras). No server, no account, no tracking - data stays on your device. Hebrew (RTL, default) and English.

**Android APK (always the latest):** `releases/latest/download/stepup.apk` · **PWA:** `https://ohadsam.github.io/distance_analyzer/` (after enabling Pages, see `docs/RELEASING.md`).

## Features
- **Workout mode** for walks and runs: GPS distance, pace, splits, pause, screen lock, resumes after a restart.
- **Smart rhythm coach**: listens to your cadence, then clicks at it with a calm pulse and a breathing guide.
- **Dashboard**: customisable widgets (effort, steps, distance, pace, consistency, weather, bests, alerts), filters and drill-down.
- **Effort bar by age and history** with alerts when a workout is far beyond the plan and gentle ways to raise the bar.
- **Quality steps**, **reminders and smart nudges**, **global search**, weather per workout, eight looks (light/dark).
- Hebrew (default) and English; works offline; no account, no server.

## Develop
```bash
npm install
npm run serve        # http://localhost:8080
npm run check && npm test && npm run e2e
```
Android: `gradle -p android assembleDebug` (needs the Android SDK; CI builds it otherwise). Docs: [Start here: project context](docs/CONTEXT.md) · [User guide](docs/USER_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [Releasing & setup](docs/RELEASING.md) · [Changelog](docs/CHANGELOG.md) · [Requests](docs/REQUESTS.md) · [Release checklist](.claude/skills/release-checklist/SKILL.md).
