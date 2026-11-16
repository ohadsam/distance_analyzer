# Requests ledger

Every request or approved suggestion from the owner, and where it lives. Walk this list before every release (see `.claude/skills/release-checklist`).
Status: ✅ shipped (version) · 🟡 partly (what is missing) · ⛔ not possible / declined, with the reason.

## Standing rules
| Rule | How it is enforced |
|---|---|
| UI simple, accessible, minimal, beautiful, self-explanatory; few things per screen | axe = 0 violations (he/en, light/dark), 320 px check, screenshots reviewed |
| Same features in the PWA and the Android app | One `web/` folder; background features mirrored natively through `native.js` -> `NativeBridge.kt` with JVM tests |
| Hebrew first, English equal; a space between number and unit | i18n parity test |
| All design assets (backgrounds, icons, animation, logo) come from ChatGPT through exact, unified-style prompts that I write and the owner pastes | checklist rule 10, `docs/DESIGN_LANGUAGE.md`, `docs/PENDING_CHATGPT_PROMPTS.md` |
| Tests are the proof; honesty about what only CI / a real device verified | release checklist |

## Requests
| # | Request | Status |
|---|---|---|
| 1 | Project skeleton: PWA + Android shell, same pipeline, checklist and quality rules as morning_organizer, `main` as the main branch | ✅ 0.1.0 |
| 2 | Design via ChatGPT prompts with one consistent, original, professional design language throughout the build | 🟡 process set up; first prompt waits for the app description |
| 3 | Walking & running tracker: distance + statistics, nicely designed widgets | 🟡 planned (phase 1, 9) |
| 4 | Daily steps counter + auto-updating steps widget; recommended steps per day | 🟡 planned (phase 2, 5, 9) |
| 5 | Route planning on a map with estimated distance; view a route on a map; mark points | 🟡 planned (phase 7; needs decisions D1/D2) |
| 6 | Weather forecast for the activity | 🟡 planned (phase 8; D1/D3) |
| 7 | Activity reminders, and completing a missed activity | 🟡 planned (phase 6, 8) |
| 8 | Effort bar (סרגל מאמצים) by age, built from step and aerobic-activity history, recommendations, alerts when off the bar | 🟡 planned (phase 5; D5) |
| 9 | Training plan by age, sessions per week, mix of workout types | 🟡 planned (phase 6) |
| 10 | In-workout indications: passing the previous distance, breaking a record, faster than last time | 🟡 planned (phase 4) |
| 11 | Statistics for progress graphs and for staying within the effort bar | 🟡 planned (phase 3, 5) |
| 12 | Many widget types | 🟡 planned (phase 2, 9) |
| 13 | Clean, simple, easy UI with comfortable buttons; Workout mode that reduces buttons to a minimum | 🟡 planned (phase 1, standing rule) |
| 14 | Extra ideas proposed by Claude and implemented | 🟡 listed in ROADMAP phase 10, awaiting approval per item |
| 15 | Smart metronome during a run: learns the cadence silently, then clicks at it with a steady, beautiful animation that helps hold rhythm and breathing | ✅ 0.2.0 (real-device tuning pending) |
| 16 | Efficiency, security, performance, good-looking and simple UI/UX; code review and UI tests | 🟡 ongoing (0.2.0: review + e2e/axe done for what exists) |
| 17 | Name the app and put it in the logo and the app | ✅ name **StepUp** (0.2.1, in the app); logo + wordmark come with ChatGPT round 2 |
| 20 | Maintain md docs of what was done, file structure and purpose, architecture, tests, so work can continue with full context | ✅ 0.3.0 (`docs/CONTEXT.md`, `TESTING.md`, `CLAUDE.md`, file-map test) |
| 21 | Effort-bar deviation detection with a notification explaining the deviation, why it is a problem and gentler ways to raise the bar | ✅ 0.3.0 (alerts: long / fast / surge; one-tap gentle bar) |
| 22 | Daily steps calculations consider continuous distance, speed etc., in dashboards/statistics and in adjusting the effort bar | 🟡 0.3.0 (quality steps in dashboard and recommendation; passive step counter and tighter bar coupling later) |
| 23 | Reminders for walks and movement exercises; smart system recommendations when there was no movement for a long time; switchable in Settings | ✅ 0.3.0 while the app is open; 🟡 background delivery on Android pending |
| 24 | Comfortable, flexible, customisable dashboard with search, filters and drill-down on every widget | ✅ 0.3.0 |
| 25 | Weather in the graphs and performance by weather at activity time | 🟡 0.3.0 manual weather + weather widget/filter; automatic weather needs D1 (internet) |
| 26 | Global search across everything (settings, history, alerts...) | ✅ 0.3.0 |
| 27 | Push to `main` | ✅ done (CI on main) |
| 28 | Logo and icons look too simple: improve them significantly | 🟡 round-3 design prompt written (`docs/prompts/ROUND3_PROMPT.txt`), waiting for ChatGPT results |
| 29 | Recommendations for walking/running by weather: the preferred times of day, considering the historical routine (usual hours, 2-3 sessions a day) and giving general best hours | ✅ 0.4.0 (live forecast format to verify on a device) |
| 30 | A recommendations widget with drill-down on the dashboard, and a toolbar button to a recommendations screen (weather, effort bar, ...) | ✅ 0.4.0 |
| 31 | Optional notifications about good times (setting) | ✅ 0.4.0 while the app is open; background delivery pending |
| 32 | Quick buttons, e.g. "Start measuring now" that measures distance and shows the position on a map | ✅ 0.5.0 (live map without background tiles; tiles need D2) |
| 33 | Save a measured path as a route; manage routes | ✅ 0.5.0 |
| 34 | Progress/improvement graphs per route | ✅ 0.5.0 |
| 35 | Recommend routes by where performance was best relative to time, hour and weather | ✅ 0.5.0 (needs real-track validation) |
| 36 | Mark a route one-time (trip/holiday) so recommendations ignore it | ✅ 0.5.0 |
| 37 | Android background service: tracking with the screen off, all-day step sensor, notifications while the app is closed | 🟡 0.6.0 built and tested against a stand-in bridge; real-device and CI Kotlin verification pending |
| 38 | New, more special logo: a runner along the shore at sunset, rounded, with wind movement | 🟡 0.7.1 integrated "Little Trail" (rounded hills + trail S + sun); not yet the runner/sunset/wind concept - awaiting the owner's verdict |
| 39 | Home-screen widgets (daily steps, effort, quick start) | ✅ 0.7.0 (launcher verification pending); more looks later with the widget art |
| 40 | Training plans by age, level, sessions per week and a mix of workout types, with completion of missed sessions | ✅ 0.8.0 (no coach review yet) |
| 19 | Hebrew (RTL) is the default language; English selectable in Settings | ✅ already so (0.1.0), kept |
| 18 | Phase 1 (core tracking) | 🟡 0.2.0: foreground only; foreground location service, auto-pause, voice/vibration cues and backup/restore still to do |
| 41 | Live in-workout indications: about to pass last distance / record, faster than last time | ✅ 0.8.1 (feel on a real run unverified) |
| 42 | Easier usability: bottom navigation, collapsible settings, fewer default widgets, first-run welcome | ✅ 0.9.0 |
| 43 | More widget types and designed widget backgrounds | 🟡 0.9.1: Last workout + Next session widgets and a vector gradient/hills background; launcher check and ChatGPT background art pending |
| 44 | Download the newest APK from inside the app (web and Android), check for updates, share the app | ✅ 0.10.0 (install/share on a real phone unverified) |
| 45 | Use the round-5 ChatGPT kit (widget backgrounds, empty states, weather, badges, splash) | ✅ 0.11.0 (rhythm keyframes, chart spec, portrait splash not yet used; device look unverified) |
| 46 | Better look and flow: kit rhythm visuals (flash-safe), chart language, folded filters, spoken cues | ✅ 0.12.0 (voice and device look unverified) |
| 47 | Backup and restore of data; weekly bars widget; monthly summary | ✅ 0.13.0 (Android dialogs and widget unverified on a device) |
| 48 | Map tiles (decision D2) | ✅ 0.14.0 opt-in OpenStreetMap, privacy explained (provider response on real devices unverified) |
| 49 | Battery and resource optimisation of the background processes | ✅ 0.14.0 adaptive GPS, per-widget redraw, hourly sensor alarm, no work while hidden (no battery measurement on a device) |
| 50 | Record celebration: selfie on a podium with medal/trophy, animated, shareable | ✅ 0.14.0 simple art in code; polished art requested (ROUND6 prompt) |
| 51 | New minimal workout screen (map, km, speed, pause/stop, alerts, voice, metronome) | ✅ 0.15.0 |
| 52 | Voice from the background service; stop hint; sunlight mode; weekly challenge; Sunday summary; permissions explained | ✅ 0.15.0 (voice with the screen off unverified on a device) |
| 53 | Use the celebration kit (podium layers, cards, badges) | ✅ 0.15.0 |
| 54 | Implement all UI/UX suggestions: choose workout numbers, time-of-day home, hands-free, share workout picture, history sort/records/voice filter, GPX, countdown, wide layout | ✅ 0.16.0 (device checks pending; polished art requested in ROUND7 prompt) |
