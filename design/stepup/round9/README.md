# StepUp Trail Athlete V3 — integrated limbs and sporty silhouettes

This iteration reconstructs the athlete with longer legs, anatomically continuous two-part arms and legs, sleeves and shorts overlapping the joints, integrated shoes, a sporty sun headband, and the StepUp sun / two hills / winding trail at the centre of the jersey. Running has stronger stride geometry, a forward-driving stance and streaks.

- `inline/`: eight distinct poses × light/dark × 96/200 = 32 FORM R SVGs. Embed SVG inline and apply `.anim-on` and `trail-motion.css`. No inline `style` attributes.
- `standalone/`: walk/run × light/dark = 4 FORM S SVGs with internal `<style>`; CSP may block internal CSS.
- `trail-motion.css`: joint pivots, 1200ms walk, 700ms run, gentle bob and ribbon, reduced-motion and `.calm`.
- `preview.html`: browser preview with Calm toggle.
- `contact-sheets/`: light/dark PNG sheets.
- `validation.json`: structural, size and rendering checks.
- `build_trail_athlete_v3.py`: Python generator in ZIP.

These are original vector constructions. No lettering in artwork. Existing logo is unchanged. Device animation quality is not verified.
