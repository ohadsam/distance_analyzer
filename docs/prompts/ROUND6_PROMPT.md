Continue in this same conversation. Same rules as before: keep the StepUp "Little Trail" brand and the "Momentum" design language (calm, rounded, filled shapes, soft gradients, no outline-only icons), ORIGINAL art only, clean SVG (no filters, scripts, external references, embedded fonts/images, max 20 KB each, viewBox given, hex colours), light AND dark variants, a contact-sheet PNG per group, and tell me about anything that breaks a rule instead of bending it silently. Palette roles only: background, surface, primary (teal), success (green), warm (sunset orange), sky (blue), text, muted, outline, plus ONE new role for celebrations: gold (light #E0A800 / dark #F2C230), with silver (#B8C2CC / #8FA0B0) and bronze (#C07A4A / #D49B73).

Feature: when a person breaks a personal record, the app shows a celebration: their own selfie sits on the top step of a podium with a medal, the result is written next to it, and they can share it as a picture. I draw a simple version myself; I need the polished, premium art, split into LAYERS so I can animate them with CSS (transform and opacity only).

GROUP A - PODIUM SCENE (viewBox 360x450, 4:5), one SVG per layer, all with the same viewBox and no background so they stack exactly:
 1. podium-steps: three steps (2 left silver, 1 centre gold and highest, 3 right bronze), rounded top corners, a soft top highlight, the numbers 1/2/3 as shapes (no text/fonts).
 2. podium-floor: a soft ground shadow ellipse under the steps.
 3. avatar-frame: a ring for a circular photo (photo circle diameter 38% of the width, centred above the gold step): gold ring with a subtle inner shadow and four tiny sparkles. The centre must be fully transparent.
 4. ribbon-medal: a ribbon (teal, primary) in a V shape ending in a gold medal with a star, hanging below the avatar frame. Separate the ribbon and the medal into two files.
 5. trophy: an alternative to the medal, a simple gold trophy cup (for distance records), 96x96.
 6. laurel: two laurel branches that can wrap around the avatar frame, one file.
 7. confetti: 5 confetti pieces (rectangle, circle, triangle, ribbon curl, star) as separate small SVGs (16x16), in the palette colours, so I can scatter and animate them.
 8. rays: soft radial light rays behind the avatar, very low contrast (max 12 % opacity), centred, 360x360.
 Provide an assembled preview (all layers stacked) in the contact sheet, light and dark.

GROUP B - RECORD CARD BACKGROUNDS (1080x1350 portrait, for the shareable picture)
 3 backgrounds: "sunrise" (warm), "forest" (green), "ocean" (blue), each light and dark, calm, with the Little Trail hills at the bottom and the top 55 % kept very quiet so large text stays readable (>= 4.5:1 for the text colour on top). No text, no podium (I draw those).

GROUP C - RECORD BADGES (48x48, the same family as the existing live-indication badges)
 "distance record", "pace record", "fastest kilometre", "longest streak", "most workouts in a week" - each distinct in SHAPE, filled, light and dark.

GROUP D - SMALL MOTION SPEC
 A short JSON: durations, delays and easings for: steps rising, avatar pop, ribbon and medal drop with a small bounce, confetti fall (5 s max, no flashing, nothing faster than 3 Hz), and a static alternative for prefers-reduced-motion.

Deliver a zip: podium/, cards/, badges/, motion.json, README.md (every file, its purpose and its light/dark pair) and the contact sheets.
