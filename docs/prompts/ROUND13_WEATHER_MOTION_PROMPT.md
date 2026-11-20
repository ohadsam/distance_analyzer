Continue in this same conversation, with the **same weather icon set** you made for me ("ClockWise motion" and its "rework final" and "thunderstorm fixed" files). Use your image-generation and code tools; if you cannot generate images or run code to measure them, tell me now and stop.

## 1. WHAT I FOUND (so you know what to fix)
The app now plays your weather loops as small looping icons (12 frames of 512 x 512, shown at about 56-96 px). I measured every set:
1. **The seven reworked sets are good**: clear day / night, mostly clear day / night, partly cloudy day / night, thunderstorm. Real motion (the mean change between two neighbouring frames is about 1 to 4 out of 255), the last frame flows into the first, no magenta fringe left. **Do not touch those seven.**
2. **The other EIGHT are still almost still** (mean change 0.3 to 1.0 per frame in the first set, the drops barely travel and the clouds hardly move): `drizzle_day`, `rain_day`, `heavy_rain_day`, `freezing_rain_day`, `snow_day`, `hail_day`, `fog_day`, `overcast_day`. This round redoes **only these eight**.
3. What worked in the thunderstorm fix and must be repeated: the drops/flakes are **separate sprites composited over the cloud** (not a warp of the whole picture), every sprite moves by a clear distance every frame and **wraps around in a cycle**, the cloud only breathes or drifts a little, and the colours of the main shapes stay **identical in every frame** (nothing flickers).
4. What was not good in the earlier sets: whole-picture warps that deform the cloud shape, the particles jumping back to the top **abruptly** (please fade them in at the top and out at the bottom so the loop is invisible), and a background that was "almost" magenta. **The background must be exactly #FF00FF (255, 0, 255) with no gradient, no shadow on it, no noise.**

## 2. THE RULES (apply to every frame of every set)
- **Frame 01 of each condition = the existing frame 01 of that condition from my last upload, pixel for pixel** (same cloud, same colours, same size, same position). Rebuild the 11 other frames around it. If you do not have it any more, tell me and I will send it again - do not redraw the cloud in a new style.
- 12 frames per condition, **512 x 512 px**, played at **8 frames per second = a 1.5 second loop**. The loop must be **seamless**: the change from frame 12 to frame 01 must be of the same size as the change between any other two neighbouring frames (not bigger).
- **Same registration in all frames and all conditions**: the main object (the cloud) stays at the same scale and the same centre (+- 2 px); only the intended parts move.
- **The cloud is never deformed**: it may drift sideways by at most +- 8 px, bob up and down by at most +- 4 px, and brighten or darken by at most +- 10 % (a slow, soft breath). No warping of its outline.
- **Particles** (drops, flakes, stones, sparkles) are **opaque separate sprites** drawn in the app's style (soft, rounded, light from the top left, a thin lighter highlight, no black outlines, no text, no logos). 8 to 14 per frame depending on the condition, in **two sizes** (near = larger and faster, far = smaller and slower). They travel **a clear distance every frame**: at least 40 px per frame for rain, 16 px for snow, 70 px for hail (so the motion reads even at 56 px). They enter with a quick fade at the top edge of the rain area and leave with a quick fade at the bottom, so the wrap is invisible.
- **Calm and safe**: no flashing, no abrupt brightness change of more than 10 % of the whole picture between two frames, nothing faster than the speeds above. Every condition must look good as the still first frame.
- Light and dark app themes both show these pictures: keep the same soft rounded look and the colours you already used, no pure black, no dark halo, readable on a light and on a dark background.
- **Original work only**: no copied icons, no third-party brand, no real person. Say honestly whether you consider the files free to use (CC0) - I will not assume it.

## 3. WHAT EACH CONDITION MUST DO (the numbers are targets; you will measure them in section 5)
1. **drizzle_day** - a light cloud; **8 fine, small, pale-blue drops** falling almost straight, slowly (about 40 px per frame), the far ones smaller and slower; the cloud drifts 6 px sideways and back.
2. **rain_day** - a medium blue-grey cloud; **10 drops** falling at a slight slant (about 50 px per frame), two sizes; the cloud bobs 3 px; a tiny splash ring where a drop leaves at the bottom (2 frames long, small).
3. **heavy_rain_day** - a darker cloud; **14 drops** as short streaks, fast (about 70 px per frame), slanted; small splashes at the bottom; the cloud darkens by 8 % and back twice during the loop (soft, not a flash).
4. **freezing_rain_day** - the cloud like rain but cooler; **8 icy-blue drops** falling (about 45 px per frame) **and 6 small six-pointed ice crystals** drifting down more slowly (about 20 px per frame) with a slight sparkle (brightness +- 10 %).
5. **snow_day** - a pale cloud; **10 snowflakes** in two sizes (some six-pointed, some round dots), falling slowly (about 18 px per frame) with a gentle **sway** side to side (+- 10 px) and a slow rotation (+- 12 degrees); the cloud still.
6. **hail_day** - a cold grey-blue cloud; **9 white-and-pale-blue hail stones** (round, with a small highlight) falling fast (about 70 px per frame), **each one bounces once** (a small hop of about 14 px) near the bottom before it fades; the cloud bobs 3 px.
7. **fog_day** - a soft cloud on top and **three horizontal fog bands** under it that drift sideways **slowly in opposite directions** (about 14 px per frame, wrapping with a soft fade at the edges of the picture) while their opacity breathes by +- 12 %; the cloud itself only bobs 3 px.
8. **overcast_day** - **two overlapping clouds** (a front one and a darker one behind) drifting slowly in the same direction at different speeds (the front one 8 px over the loop, the back one 4 px: a small parallax), with a soft light change of +- 8 % passing over them; no particles.

## 4. THE FILES I NEED (and nothing else)
For each of the eight conditions, named exactly like the earlier ones:
- `wxa_<condition>_01.png` ... `wxa_<condition>_12.png` - 512 x 512, **RGB with the exact #FF00FF background** (not transparent).
- `wxa_<condition>_sheet.png` - the 12 frames in a 4 x 3 grid, 2048 x 1536.
- `<condition>_preview.gif` - the loop at 8 fps (the GIF may be 256 colours; it is only for my eyes).
- one `README.txt` with the measurements of section 5.
Deliver the eight conditions in **three zip files** (3 + 3 + 2 conditions) so that each file stays small, and **wait for my "continue" between the zips**. Show me each contact sheet at full size before I continue.

## 5. SELF-CHECK BEFORE YOU SEND (use your code tool and write the real numbers in the README; do not write "not verified" for something you can measure)
For every condition, measured on the 12 PNG files:
1. mean absolute change between neighbouring frames (0-255): the smallest, the largest and the **frame 12 -> frame 01 value**; targets: the smallest at least **1.5**, the largest at most **12**, the loop-closing value **no bigger than the largest neighbouring change**.
2. the number of particles per frame and their travel per frame in px (measured, not nominal).
3. the number of pixels that differ from **exactly (255, 0, 255)** in the background corners and in a 6 px border (it must be **0**) and the count of "magenta-ish" pixels (red and blue above 200, green below 110) on the object edges (it must be **0**).
4. the cloud's bounding box in every frame (the centre must stay within 2 px; the size within 2 %).
5. that frame 01 is identical to the earlier frame 01 of that condition (give the number of different pixels).
6. the biggest brightness change of the whole picture between two neighbouring frames (percent; it must be 10 % or less).
Also tell me honestly anything that is off: a deformed cloud, a particle that clips at the border, a jump at the loop point, a colour that changes. If a condition fails a target, **fix it and measure again** before you send it.

## 6. WHAT I WILL DO WITH IT
I key out the magenta, crop all frames to one common box, scale them to 96 x 96, cut a strip of 12 frames per condition (WebP with transparency), and play it with steps() at 1.5 s per loop on small and large sizes, in light and dark, with a "calm" switch that shows the still first frame. So a clean loop, exact registration, a perfectly flat magenta and a clear motion at a small size matter more than detail.
