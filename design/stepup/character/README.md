# StepUp mascot handoff for Claude

## Design
Chosen concept B, softer oval/dot eyes, brown tousled hair, teal headband, teal top, green shorts, teal sneakers with orange accents. Keep the same identity across all artwork.

## Files
- model-sheet.png: visual model reference (not production rig).
- walk-cycle.png: 4 columns x 2 rows, 2048 x 1024 px (512 x 512 cells), concept animation poses.
- run-cycle.png: same layout, concept animation poses.
- poses-1.png: 8 assorted character poses, 4 x 2 layout.
- poses-2.png: 8 assorted character poses, 4 x 2 layout.
- concept-B.png: earlier design reference.
- package-preview.png: overview only, NOT an actual source for sprite slicing.
- source_art/: original generated image files, before resampling.

## CRITICAL QUALITY DISCLOSURE
These are AI-generated CONCEPT illustrations, NOT validated production-ready animation assets. Source frames were resampled to 2048 x 1024, which does not add genuine detail. Some have background contamination, nontransparent pixels, red/colored edge artifacts, uneven alignment, slight design drift, and incorrect walk/run timing. Alpha channels are present but DO NOT establish clean transparent backgrounds. Grid cells are dimensionally uniform, but the artwork inside them has not been normalized to consistent anchor points or baselines. Do not directly convert to final WebP animation without manual cleanup/redrawing and a frame-by-frame QA pass. No true disassembled puppet parts or pivot coordinates are included; the preview image only depicts that proposed deliverable.

## Required production follow-up
1. Redraw/clean 8 distinct walk phases (contact/down/passing/up, opposite side), arm-leg opposition, right-facing 3/4.
2. Redraw/clean 8 distinct run phases, flight phases, consistent ~10 degree lean.
3. Match all frames to an exact character model and 512x512 safe area with >=24 px margins.
4. Remove all backgrounds, halos, colored artifacts and scene elements; ensure alpha=0 outside the character.
5. Normalize pivots, body position, scale, and frame baselines; inspect 64 px and 128 px on #F5F8FA and #111820.
6. Create actual puppet part sheet with fully drawn joint overlaps and marked pivots if needed.
7. Validate loop playback at 1.2 seconds (walk) and 0.7 seconds (run).

## Palette (target design tokens, not measured exact sampled pixels)
Teal #006B60; light teal #9CE5D6; green #216B39; light green #9BE3B1; amber #FFD28A; blue #145AA0; rust #A13F20; light background #F5F8FA; dark background #111820.
