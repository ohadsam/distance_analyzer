Continue in this same conversation. Keep the StepUp "Little Trail" brand and the "Momentum" design language we already agreed (calm, rounded, filled shapes, three-role fills: primary / success / warm accent, soft gradients, no outlines-only icons, no text inside artwork). All art must be ORIGINAL (no stock, no trademarks) and delivered as clean SVG (no filters, no scripts, no external references, no embedded fonts/images, max 20 KB each, viewBox given, colours as hex), in light AND dark variants, plus a contact sheet PNG per group so I can review quickly.

Use these palette roles only (I map them to my theme packs): background, surface, primary (teal), success (green), warm (sunset orange), sky (blue), text, muted, outline. Keep >= 4.5:1 contrast wherever text will sit on top of art, and keep the lower-right corner calm (text goes on the left/top).

GROUP A - HOME-SCREEN WIDGET BACKGROUNDS (Android, shown behind text)
 1. Four backgrounds, 4:2 (wide) and 2:2 (square) each, rounded corners 20 dp: "Steps" (gentle hills + rising path), "Effort" (soft sunrise band), "Last workout" (trail with a single small footprint trail), "Next session" (calendar-like soft horizon). Very low contrast art: it must never fight with white/dark text. Dark variants with deeper tones, same composition.
 2. A tiny 24 dp monochrome glyph for each of the four widgets (preview/picker icon).

GROUP B - ONBOARDING AND EMPTY STATES (6 illustrations, 320x200 viewBox)
 Welcome / pick your age; "no workouts yet"; "no routes yet"; "no plan yet"; "all caught up" (no alerts); "offline / no weather". Friendly, human-free or with one simple faceless walker; consistent line weight and corner radius.

GROUP C - WEATHER SCENES (6 scenes, 360x120 viewBox, used as a thin banner above the weather widget)
 clear, cloudy, rain, cold, hot, windy. Same horizon and hills as the logo so they feel like one family; day and night variants.

GROUP D - RHYTHM COACH (the smart metronome + breathing guide during a run)
 A calm breathing ring (expand/contract) as 3 static keyframes (rest, inhale, exhale) so I can animate with CSS, a "step beat" dot pulse (2 keyframes), a "learning your cadence" state and a "locked on" state. Provide a short motion spec JSON (durations, easings, scale ranges) that respects prefers-reduced-motion (a static alternative for each).

GROUP E - LIVE INDICATION BADGES (shown for ~8 seconds during a workout, 48x48)
 "almost at your last distance", "passed your last distance", "almost a record", "new record", "faster than last time", "fastest kilometre yet". Filled, simple, readable at small size, each distinct in SHAPE (not only colour).

GROUP F - CHART LANGUAGE
 A short spec + sample SVG for bar, line and heat-strip charts: bar corner radius, line weight, dot size, gridline opacity, target-line style, "now" highlight, and light/dark colour assignments using only the palette roles.

GROUP G - SPLASH
 Android 12 splash icon (432 px safe circle) and a 1080x1920 portrait splash with the Little Trail mark, light and dark.

Deliver: a zip with folders widgets/, onboarding/, weather/, rhythm/, badges/, charts/, splash/, a README.md listing every file with its purpose and its light/dark pair, and the contact sheets. Tell me anything that violates the rules above instead of silently bending them.
