# Design language (single source of truth for every visual asset)

Status: **foundation integrated (0.2.0)** from the ChatGPT "Momentum" kit in `design/momentum/` (see its `DESIGN.md`: 24 grid, 1.8 stroke, round caps, no gradients/shadows, 48 dp targets, eight packs x light/dark, semantic tokens only). Round 2 (`docs/prompts/ROUND2_PROMPT.txt`) upgrades the placeholders.
Known gaps in round 1: generic-looking icon geometry (originality), placeholder brand mark, art = icon in a circle, near-invisible backgrounds, widget shells are plain boxes, no rhythm-coach art/motion, no logo concepts / adaptive icon layers / PNGs.
Direction already fixed: energetic, calm, trustworthy; open road / horizon / morning air; outdoor-in-sunlight legibility; four packs `trail` (default), `coast`, `ember`, `sunlight` (high-contrast, also the Workout-mode look).
Every later prompt must restate the decisions below, so icons, backgrounds, illustrations and animations stay one family.

## To define (owner + first round)
- App personality in 3 words, audience, tone (Hebrew first, English equal).
- Palette tokens (light + dark): `bg surface ink muted line brand brand2 accent good warn bad`, artwork colours `k1..k8`; contrast targets (ink 4.5:1, UI glyphs 3:1).
- Geometry: icon grid, stroke width and caps, corner radius logic, light direction, level of detail.
- Style packs (if any) and how they re-colour the same artwork.
- Motion: gentle, no flashing, loops >= 800 ms, every animation is complete as a still first frame; a "calm animations" switch turns them off.
- Hard rules: original work only (no copied sets/brands/people/living artists), CC0, no text inside art, RTL-safe (directional glyphs delivered as `-start`/`-end` pairs).
- Technical contract with the app: allowed SVG elements, sizes, `currentColor` / token classes, file naming, size budget (APK and service-worker precache must stay small).
