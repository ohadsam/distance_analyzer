# Design language (single source of truth for every visual asset)

Status: **draft - to be filled from the first ChatGPT round** (`docs/prompts/STYLE_SYSTEM_PROMPT.md`, not yet written: waiting for the app description).
Every later prompt must restate the decisions below, so icons, backgrounds, illustrations and animations stay one family.

## To define (owner + first round)
- App personality in 3 words, audience, tone (Hebrew first, English equal).
- Palette tokens (light + dark): `bg surface ink muted line brand brand2 accent good warn bad`, artwork colours `k1..k8`; contrast targets (ink 4.5:1, UI glyphs 3:1).
- Geometry: icon grid, stroke width and caps, corner radius logic, light direction, level of detail.
- Style packs (if any) and how they re-colour the same artwork.
- Motion: gentle, no flashing, loops >= 800 ms, every animation is complete as a still first frame; a "calm animations" switch turns them off.
- Hard rules: original work only (no copied sets/brands/people/living artists), CC0, no text inside art, RTL-safe (directional glyphs delivered as `-start`/`-end` pairs).
- Technical contract with the app: allowed SVG elements, sizes, `currentColor` / token classes, file naming, size budget (APK and service-worker precache must stay small).
