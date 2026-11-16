# StepUp record celebration

Original artwork, CC0. Existing assets untouched. Momentum reference colors plus authorized metals. All SVGs transparent except cards.

## Composition
Photo center (180,114), diameter 136.8. Stack rays at (0,-66), floor, steps, laurel, app photo, frame, ribbon, medal, confetti. Trophy alternative at (132,184), 96 square. Confetti 16 square; position freely. Rays 360 square; all other scene layers 360×450. Use photo circular clip. Contact sheet placeholder is not a delivered photo.

## Files
- `podium/podium-steps-light.svg` / `podium/podium-steps-dark.svg`: Three rounded metallic steps with custom filled numerals.
- `podium/podium-floor-light.svg` / `podium/podium-floor-dark.svg`: Ground shadow.
- `podium/avatar-frame-light.svg` / `podium/avatar-frame-dark.svg`: Transparent 136.8 diameter photo opening, metallic ring and four sparkles.
- `podium/ribbon-light.svg` / `podium/ribbon-dark.svg`: V ribbon, separate from medal.
- `podium/medal-light.svg` / `podium/medal-dark.svg`: Gold medal with star.
- `podium/trophy-light.svg` / `podium/trophy-dark.svg`: Alternative trophy, place at x132 y184.
- `podium/laurel-light.svg` / `podium/laurel-dark.svg`: Two filled leaf branches around avatar.
- `podium/confetti-rectangle-light.svg` / `podium/confetti-rectangle-dark.svg`: Independent confetti particle.
- `podium/confetti-circle-light.svg` / `podium/confetti-circle-dark.svg`: Independent confetti particle.
- `podium/confetti-triangle-light.svg` / `podium/confetti-triangle-dark.svg`: Independent confetti particle.
- `podium/confetti-curl-light.svg` / `podium/confetti-curl-dark.svg`: Independent confetti particle.
- `podium/confetti-star-light.svg` / `podium/confetti-star-dark.svg`: Independent confetti particle.
- `podium/rays-light.svg` / `podium/rays-dark.svg`: Low-opacity radial rays; place x0 y-66 to align with photo.
- `cards/sunrise-light.svg` / `cards/sunrise-dark.svg`: Share background, top 55% reserved for text.
- `cards/forest-light.svg` / `cards/forest-dark.svg`: Share background, top 55% reserved for text.
- `cards/ocean-light.svg` / `cards/ocean-dark.svg`: Share background, top 55% reserved for text.
- `badges/distance-record-light.svg` / `badges/distance-record-dark.svg`: Live record badge: distance record.
- `badges/pace-record-light.svg` / `badges/pace-record-dark.svg`: Live record badge: pace record.
- `badges/fastest-kilometre-light.svg` / `badges/fastest-kilometre-dark.svg`: Live record badge: fastest kilometre.
- `badges/longest-streak-light.svg` / `badges/longest-streak-dark.svg`: Live record badge: longest streak.
- `badges/most-workouts-week-light.svg` / `badges/most-workouts-week-dark.svg`: Live record badge: most workouts week.

- `podium/contact-sheet.png`, `cards/contact-sheet.png`, `badges/contact-sheet.png`: actual raster previews.
- `motion.json`: one-shot CSS transform/opacity instructions and reduced motion.
- `palette.json`: reference hex values.
- `validation.json`: checks and measured card contrast.
- `build_celebration.py`: generator (requires prior extension palette at path in script, CairoSVG, Pillow, NumPy).

Limitations: no physical device testing or user recognition study. Card contrast measured only for theme text token in top 55%. Rays individual wedges 8% opacity, no overlap except at center boundary. No actual selfie or result text included. Dark metallic numerals use background color for contrast.
