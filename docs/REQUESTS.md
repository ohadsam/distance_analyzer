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
