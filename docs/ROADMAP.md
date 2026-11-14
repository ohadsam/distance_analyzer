# Roadmap - StepUp (walking & running tracker)

Ordered so that every phase ships something usable and the later phases build on the earlier ones. Status of each request lives in `REQUESTS.md`.
Core idea: **clean, simple, self-explanatory**; a **Workout mode** that strips the screen to a few big buttons.

## Open decisions (need the owner's OK before the phase that depends on them)
| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| D1 | **Network.** Maps (tiles) and weather need internet; the skeleton has none (no `INTERNET`, CSP `'self'`). | Core tracking, steps, stats, plans, widgets stay 100 % offline. Network only on screens that need it (map, weather), fixed hosts listed in the CSP and in `ARCHITECTURE.md`, nothing sent except coordinates/tiles requested; the rest degrades gracefully offline. | Phase 7-8 |
| D2 | **Map source.** OSM's public tile servers forbid heavy app use; commercial ones need keys. | Verify licence/usage policy first (checklist rule 8). Prefer a free no-key tile source + a small in-house tile renderer (zero dependencies) over a map library; fall back to a plain track drawing (no tiles) when offline. | Phase 7 |
| D3 | **Weather source.** | Open-Meteo (free, no key, forecast by lat/lon); verify terms for an app. | Phase 8 |
| D4 | **Health data.** Step counting and heart rate. | Android step sensor (no account). Optional later: Health Connect import (watches, other apps). PWA cannot count steps: that part is Android-only and hidden in the browser. | Phase 2, 10 |
| D5 | **Medical wording.** | Effort zones and plans are general guidance based on public recommendations (WHO activity guidelines, age-based heart-rate estimates); shown with a short "not medical advice" note; check with a doctor before starting if unsure. | Phase 5-6 |
| D6 | **Units.** | km/min-per-km by default (Israel), miles optional. | Phase 1 |

## Phases
**0. Foundation** ✅ - PWA + Android shell, CI, checklist, design-prompt workflow.

**1. Core tracking (the heart)**
- Pure logic (unit-tested): distance from GPS points (haversine), accuracy/jump filtering and smoothing, pace, speed, splits per km, moving vs paused time, calorie estimate (weight-based), unit conversion.
- Activity types: walk, run, hike, intervals/treadmill (manual entry).
- Android: foreground location service (survives screen-off), `ACCESS_FINE_LOCATION` + notification; web: Geolocation while the page is open.
- **Workout mode:** one big Start/Pause/Finish, live distance-time-pace, screen kept awake, almost no other buttons, optional lock against accidental taps, optional voice/vibration cues per km.
- History list, workout detail, edit/delete, local storage (IndexedDB + memory fallback), backup/restore file.

**2. Steps**
- Android step counter (`ACTIVITY_RECOGNITION`), daily total that survives reboot, day roll-over, goal, history; recalibrated stride length from GPS walks.
- **Daily steps widget** (auto-updating) - first widget; more in phase 9.

**3. Statistics & progress charts** - own lightweight SVG charts (no library): week/month/year distance, time, pace trend, steps per day, consistency, personal bests table; compare periods.

**4. Live indicators during a workout** - "about to pass your previous distance", "about to break your record", "faster than last time" (ghost comparison against a chosen earlier workout or best), as a calm banner + optional haptic/voice; fully configurable.

**5. Effort bar (סרגל מאמצים) by age and history** - personal weekly target from age (public guidelines) and from the last weeks of steps + aerobic minutes (adapts gradually, never jumps); today/this week bar; **recommended steps per day**; gentle alerts when the pattern drifts from the bar or too much too fast (injury-prevention rest hint). Heart-rate zones estimated from age.

**6. Training plans** - build a plan from age, level, goal (first 5K, 10K, general fitness, weight), sessions per week and the mix of types (easy, intervals, long, tempo, strength/mobility, rest); week view; mark done, **auto-reschedule or complete a missed session**; plan progress in the stats.

**7. Routes & map** - plan a route by tapping points with distance estimate, save routes, show a finished workout on the map, mark points of interest, follow a saved route (needs D1/D2).

**8. Weather & reminders** - forecast for the planned time and a "best window today" suggestion; reminders (scheduled workout, daily steps nudge, "you missed Tuesday - catch up today?"), quiet hours, reminders survive reboot (needs D1/D3).

**9. More widgets** - today's goal ring, weekly bars, last workout, next planned workout, streak, quick-start button; several sizes and looks matching the style packs.

**10. Extra ideas (propose, owner approves)**
- Personal records & achievements (longest, fastest km/5K/10K, streaks, monthly challenges) with a small celebration.
- Shoes: mileage per pair with a "time to replace" hint.
- Export/import GPX and CSV; share a workout summary card.
- Warm-up/cool-down and stretching guides; safe-running tips (heat, dark, hydration).
- Sunrise/sunset times in the planner; "weather-aware" plan suggestions.
- Health Connect import (watch, other apps); heart-rate from a Bluetooth sensor.
- Simple weight/BMI-free body-trend (optional, private), sleep-free: keep scope calm.
- Voice coach with interval timers (run 1:00 / walk 2:00).
- Auto-pause when stopped; auto-detect a started walk and offer to record.
- Family/friends challenge by sharing a code (no server).

## Design assets (ChatGPT)
See `PENDING_CHATGPT_PROMPTS.md`. Order: style system + logo + UI icons → activity/weather/widget art → badges, records, animations, illustrations and backgrounds.
