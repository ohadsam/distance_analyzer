# Requests ledger

Every request or approved suggestion from the owner, and where it lives. Walk this list before every release (see `.claude/skills/release-checklist`).
Status: ✅ shipped (version) · 🟡 partly (what is missing) · ⛔ not possible / declined, with the reason.

## Standing rules
| Rule | How it is enforced |
|---|---|
| UI simple, accessible, minimal, beautiful, self-explanatory; few things per screen | axe = 0 violations (he/en, light/dark), 320 px check, screenshots reviewed |
| Same features in the PWA and the Android app | One `web/` folder; background features mirrored natively through `native.js` -> `NativeBridge.kt` with JVM tests |
| Hebrew first, English equal; a space between number and unit | i18n parity test |
| Tests are the proof; honesty about what only CI / a real device verified | release checklist |

## Requests
| # | Request | Status |
|---|---|---|
| 1 | Project skeleton: PWA + Android shell, same pipeline, checklist and quality rules as morning_organizer, `main` as the main branch | ✅ 0.1.0 |
