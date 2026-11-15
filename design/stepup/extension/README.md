# StepUp extension — Little Trail / Momentum

Additive kit; existing assets and tokens untouched. Original new artwork released CC0; existing Little Trail mark reused from approved package.

Palette: warm = existing run (sunset orange), sky = existing walk. No production token changes. Hex values in palette.json. Light/dark weather correspond to day/night. Widget text uses text token, not arbitrary white on light. Widget corner radius 20 viewBox units at reference height 100dp; apply native 20dp clipping at other sizes. Lower-right and left/top art opacity 9%. Android icon uses conservative 288px safe diameter within 432 canvas.

## Inventory

### badges

| Light | Dark | ViewBox | Purpose |

|---|---|---|---|

| badges/almost-distance-light.svg | badges/almost-distance-dark.svg | 48×48 | Live indication: almost-distance |

| badges/passed-distance-light.svg | badges/passed-distance-dark.svg | 48×48 | Live indication: passed-distance |

| badges/almost-record-light.svg | badges/almost-record-dark.svg | 48×48 | Live indication: almost-record |

| badges/new-record-light.svg | badges/new-record-dark.svg | 48×48 | Live indication: new-record |

| badges/faster-last-light.svg | badges/faster-last-dark.svg | 48×48 | Live indication: faster-last |

| badges/fastest-km-light.svg | badges/fastest-km-dark.svg | 48×48 | Live indication: fastest-km |

Contact sheet: badges/contact-sheet.png

### charts

| Light | Dark | ViewBox | Purpose |

|---|---|---|---|

| charts/bar-light.svg | charts/bar-dark.svg | 320×160 | Chart sample, no embedded labels |

| charts/line-light.svg | charts/line-dark.svg | 320×160 | Chart sample, no embedded labels |

| charts/heat-strip-light.svg | charts/heat-strip-dark.svg | 320×160 | Chart sample, no embedded labels |

Contact sheet: charts/contact-sheet.png

### onboarding

| Light | Dark | ViewBox | Purpose |

|---|---|---|---|

| onboarding/welcome-light.svg | onboarding/welcome-dark.svg | 320×200 | Onboarding or empty state: welcome |

| onboarding/no-workouts-light.svg | onboarding/no-workouts-dark.svg | 320×200 | Onboarding or empty state: no-workouts |

| onboarding/no-routes-light.svg | onboarding/no-routes-dark.svg | 320×200 | Onboarding or empty state: no-routes |

| onboarding/no-plan-light.svg | onboarding/no-plan-dark.svg | 320×200 | Onboarding or empty state: no-plan |

| onboarding/caught-up-light.svg | onboarding/caught-up-dark.svg | 320×200 | Onboarding or empty state: caught-up |

| onboarding/offline-light.svg | onboarding/offline-dark.svg | 320×200 | Onboarding or empty state: offline |

Contact sheet: onboarding/contact-sheet.png

### rhythm

| Light | Dark | ViewBox | Purpose |

|---|---|---|---|

| rhythm/breath-rest-light.svg | rhythm/breath-rest-dark.svg | 64×64 | Breathing ring static keyframe |

| rhythm/breath-inhale-light.svg | rhythm/breath-inhale-dark.svg | 64×64 | Breathing ring static keyframe |

| rhythm/breath-exhale-light.svg | rhythm/breath-exhale-dark.svg | 64×64 | Breathing ring static keyframe |

| rhythm/beat-rest-light.svg | rhythm/beat-rest-dark.svg | 64×64 | Step beat static keyframe |

| rhythm/beat-pulse-light.svg | rhythm/beat-pulse-dark.svg | 64×64 | Step beat static keyframe |

| rhythm/learning-light.svg | rhythm/learning-dark.svg | 64×64 | Learning cadence |

| rhythm/locked-light.svg | rhythm/locked-dark.svg | 64×64 | Cadence locked |

Contact sheet: rhythm/contact-sheet.png

### splash

| Light | Dark | ViewBox | Purpose |

|---|---|---|---|

| splash/android-icon-light.svg | splash/android-icon-dark.svg | 432×432 | Android splash mark within 288px diameter safe circle |

| splash/portrait-light.svg | splash/portrait-dark.svg | 1080×1920 | Portrait splash, mark centered |

Contact sheet: splash/contact-sheet.png

### weather

| Light | Dark | ViewBox | Purpose |

|---|---|---|---|

| weather/clear-light.svg | weather/clear-dark.svg | 360×120 | Weather banner; light=day, dark=night |

| weather/cloudy-light.svg | weather/cloudy-dark.svg | 360×120 | Weather banner; light=day, dark=night |

| weather/rain-light.svg | weather/rain-dark.svg | 360×120 | Weather banner; light=day, dark=night |

| weather/cold-light.svg | weather/cold-dark.svg | 360×120 | Weather banner; light=day, dark=night |

| weather/hot-light.svg | weather/hot-dark.svg | 360×120 | Weather banner; light=day, dark=night |

| weather/windy-light.svg | weather/windy-dark.svg | 360×120 | Weather banner; light=day, dark=night |

Contact sheet: weather/contact-sheet.png

### widgets

| Light | Dark | ViewBox | Purpose |

|---|---|---|---|

| widgets/steps-wide-light.svg | widgets/steps-wide-dark.svg | 200×100 | Low-contrast widget background |

| widgets/steps-square-light.svg | widgets/steps-square-dark.svg | 100×100 | Low-contrast widget background |

| widgets/steps-picker-light.svg | widgets/steps-picker-dark.svg | 24×24 | Monochrome picker glyph |

| widgets/effort-wide-light.svg | widgets/effort-wide-dark.svg | 200×100 | Low-contrast widget background |

| widgets/effort-square-light.svg | widgets/effort-square-dark.svg | 100×100 | Low-contrast widget background |

| widgets/effort-picker-light.svg | widgets/effort-picker-dark.svg | 24×24 | Monochrome picker glyph |

| widgets/last-workout-wide-light.svg | widgets/last-workout-wide-dark.svg | 200×100 | Low-contrast widget background |

| widgets/last-workout-square-light.svg | widgets/last-workout-square-dark.svg | 100×100 | Low-contrast widget background |

| widgets/last-workout-picker-light.svg | widgets/last-workout-picker-dark.svg | 24×24 | Monochrome picker glyph |

| widgets/next-session-wide-light.svg | widgets/next-session-wide-dark.svg | 200×100 | Low-contrast widget background |

| widgets/next-session-square-light.svg | widgets/next-session-square-dark.svg | 100×100 | Low-contrast widget background |

| widgets/next-session-picker-light.svg | widgets/next-session-picker-dark.svg | 24×24 | Monochrome picker glyph |

Contact sheet: widgets/contact-sheet.png

## Other files

palette.json — reference hex roles; validation.json — checks and exact sizes; rhythm/motion.json — static frames and animation guidance; charts/spec.md — chart rules; build_extension.py — generator (requires approved Little Trail ZIP, CairoSVG, Pillow).

## Limitations

No native Android device test. Weather day/night are paired with light/dark rather than four independent combinations. Text contrast verified for opaque widget pixels only; no text intended over other illustrations. Contact sheets are review-scale, not native-size tests. Chart samples have no labels; app supplies them.