Continue in this same conversation. Thank you for the Trail Companion kit. I integrated its eight poses in the app (start cards, welcome card, workout summary) and reviewed them. **Two big problems: Trail does not look SPORTY, and the link to the StepUp logo is too weak.** This round redraws Trail as a real athlete and completes the missing scope. Keep every rule of the Round 9 prompt (the logo-born character, FORM R = inline rig with the whitelist, FORM S = standalone scenes with internal CSS keyframes, palette tokens, <= 20 KB per file, gentle motion, a complete still frame, the "calm" switch, no text in the art, original work, CC0). Work in stages and wait for "continue".

## 1. WHAT IS WRONG NOW
- **Not sporty.** The current Trail is a round, chubby figure in a beanie, with a stubby body and short legs. It looks like a toy, not like someone who walks and runs. People will open this app to train: the character must look like a fit, lively, motivated athlete.
- **Weak logo link.** The head is rust brown (reads as a skin tone), the body does not read as the logo's hills, and the S-shaped trail is only a faint line on the chest.
- **Poses are the same picture** (walk, run, idle, rest, wave, focus differ only by CSS rotation values).
- Technical: inline style attributes (blocked by my CSP), only two silhouettes, no scenes, no countdown, no weather, no time-of-day art.

## 2. THE NEW BRIEF: A SPORTY CHARACTER WHOSE BODY IS THE LOGO
Think of the best modern sports-brand mascots and fitness-app characters in terms of *energy and anatomy*, but draw something completely original (no copying of any mascot, brand, athlete or living artist's style).
**Proportions:** about 4 heads tall (athletic, slim, light on its feet), NOT a round blob. Defined but soft-edged limbs: a long stride, a visible knee and ankle line, strong calves, a narrow waist, a lifted chest. Rounded shapes everywhere (the Momentum language) but with *athletic tension*: bent elbows at 90 degrees, a forward lean when running, a drive knee, a back foot pushing off, a tilted head looking ahead.
**Sports kit (what makes it read as an athlete at 24 px):** a **running singlet / sports top** in the brand colours with a bold chest panel, **short running shorts or fitted tights**, **real running shoes** (a thick midsole, a toe cap, a heel tab, laces as two tiny marks, a small accent stripe), a **sports headband or visor** in the accent colour, wrist bands or a small sports watch on one wrist, and, for running, a small hydration belt or number bib *without any digits or letters* (an abstract bib shape). Compression sleeves for one arm are welcome. Keep the kit simple: 3 colours at most.
**Motion language:** every pose has a strong **line of action** (a clear diagonal or an S-curve through the body), anticipation and follow-through, and the ribbon always shows the direction of travel.

## 3. THE LOGO, WORN BY THE ATHLETE (keep it unmistakable)
The StepUp mark (viewBox 64x64) is: a **teal rounded hill** #006B60 (left, tall), a **green rounded hill** #216B39 (right, lower), separated by an **S-shaped gap - the trail** - and a **warm amber sun disc** #865000 above them. Paths:
  teal hill:  M6 43C6 35 11 29 18 24C23 20 28 19 32 23L37 28C29 30 23 34 24 39C25 44 35 45 32 49C30 52 25 55 19 56H15C9 56 6 51 6 43Z
  green hill: M40 30C45 27 49 28 54 33C58 37 59 42 58 47C57 53 53 56 47 56H29C36 53 40 49 39 45C38 41 29 40 30 37C31 34 35 32 40 30Z
  sun:        circle cx=44 cy=15 r=7.5
Map it onto the athlete like this, and show the mapping on the design sheet:
- **The HEAD is the sun disc**: amber #865000 in light mode, #FFD28A in dark mode (never brown skin), a soft highlight and a thin darker ring, faceless by default; the headband / visor sits on it in the accent colour.
- **The TORSO is the teal hill**: the sports top is the teal hill shape (its rounded shoulder line = the athlete's shoulders and chest), in #006B60 (dark mode #9CE5D6).
- **The LEGS and shorts are the green hill**: the shorts and legs use the green hill's two soft lobes (the lobes become the two legs when striding), #216B39 (dark mode #9BE3B1).
- **The S-shaped trail gap is a big, bold, flowing ribbon** - a sports sweatband / tail of motion - that streams behind the body from the shoulder, always the same S curve as the logo's gap, in a light tint, so that the silhouette of body plus ribbon reads as the logo in motion. It is the signature: **do not reduce it to a faint line on the chest**.
Accent colours for small touches only: walk = blue #145AA0 (headband, shoe stripe), run = rust #A13F20. Dark mode ink #F5F8FA, surface #1C2732, background #111820; light mode ink #17232D, surface #FFFFFF, background #F5F8FA.
Required check: a person who knows the logo must say "that is the logo, running". Deliver a **logo-to-athlete design sheet** (logo, the same shapes highlighted on the character, the one-colour silhouette, front / side / three-quarter views, light and dark, at 24, 64, 200 and 400 px).

## 4. THE POSES (every pose must be a different, strong static drawing that already tells the story)
- **walk**: confident mid-stride, long step, arms counter-swinging, upright but athletic.
- **run**: forward lean, one foot clearly off the ground, a high drive knee, arms driving at 90 degrees, speed streaks, the ribbon streaming flat behind.
- **sprint / finish** (arms up and a hop with the ribbon rising) and **cheer** (both fists up, a jump).
- **warm-up stretch** (a quad or reach stretch), **rest** (hands on knees, bent, a sweat drop in m-sweat), **wave** (one arm up), **focus** (a crouched start stance, the "on your marks" pose), **idle** (relaxed athletic stand, weight on one leg).
Put the static rotations in a transform attribute (e.g. transform="rotate(27 85 142)"), never in a style attribute (my CSP blocks it). Keep pivots in the motion CSS (transform-box: fill-box and origins per part).
Rig parts as before: m-head, m-eyes, m-smile, m-sweat, m-torso, m-arm-a, m-arm-b, m-leg-a, m-leg-b (each leg may have m-shin for a bending knee animation), m-ribbon, m-shadow, m-streaks, m-prop, m-extra.

## 5. WHAT IS STILL MISSING (deliver it all, in the same athletic character)
A. **WORKOUT SCREEN (rig):** ready (a stretch, 3 s loop), running-along (a small run cycle for the map corner), paused (hands on knees, slow breathing, sweat drop), and the **countdown**: four one-shot 700 ms animations (crouch, crouch, crouch, launch) for 3-2-1-go.
B. **CELEBRATION (scenes and rig):** a victory jump with confetti, holding a medal (m-prop), lifting a trophy, standing on the winner step.
C. **HOME BY THE TIME OF DAY (scenes, banner-friendly 360x120 crops):** morning (a stretch and a yawn at sunrise), afternoon (a run with the sun high), evening (a cool-down walk at sunset), night (asleep under the moon with slow breathing). When the sun is in the scene, give the head a thin darker ring so the two are never confused.
D. **EMPTY STATES AND ONBOARDING (scenes):** no workouts (at the start line, looking along the trail), no routes (holding a map, pointing), no plan (holding a calendar page), offline (sitting beside a broken-cloud sign), caught up (relaxed, a check mark above), alerts empty, welcome (a wave).
E. **WEATHER AND RECOMMENDATIONS (scenes):** rain (a running jacket with a hood, or an umbrella), hot (a sweat drop and a water bottle), cold (a scarf made from the trail ribbon, sleeves), windy (leaning into the wind, the ribbon flying), clear (a happy run).
F. **PLAN, ALERTS, LOADING, SEARCH, GUIDE (rig):** session done, rest day, nudge (a bell prop that rings), loading (jogging in place, 900 ms loop, used as a spinner), searching (a magnifier prop), guide pointing (one direction; I mirror it for RTL), thinking.
G. **SHARE CARD (scenes, 1080x1350 art layers):** the athlete on the workout picture, a walk version (forest) and a run version (sunrise), static with a one-shot entrance animation.
H. **ONE-COLOUR SILHOUETTES** (currentColor, 24 and 96 grid): walk, run, rest, celebrate, sprint, for the notification icon, widgets and the share-picture watermark. The silhouette alone must say "athlete" (a stride, a lean, the ribbon).

## 6. ANIMATIONS
Loops are gentle (>= 700 ms cycles), never flashing, always a complete still frame; walk cycle 1200 ms, run cycle 700 ms (with a bending knee, a pushing back foot, arms driving, a 1 px bob, the ribbon streaming), plus one-shots for finish, cheer, countdown and the entrance of the share card. Deliver \`motion.json\`, \`character-motion.css\` (selectors scoped by \`.trail-companion.anim-on[data-pose="..."]\`, an @media (prefers-reduced-motion: reduce) block, and \`html[data-calm="1"]\` stops everything), \`preview.html\` playing everything with an animation toggle at 24, 64, 96 and 200 px, \`validation.json\` (whitelist check for the rig, byte size, viewBox, only transform and opacity animated, no style attributes in the rig, contrast >= 3:1, every animation complete as a still frame, the head / torso / legs / ribbon built from the logo shapes), and contact sheets (PNG) with **old Trail beside the new athlete**.

## 7. STAGES
STAGE 1 = the redrawn athlete: the logo-to-athlete design sheet, the eight redrawn poses plus sprint and warm-up, the silhouettes, and the walk and run cycles - I will review the look before you continue. STAGE 2 = groups A, B, F (rig). STAGE 3 = groups C, D, E, G (scenes), the motion spec, the preview and the validation report.
