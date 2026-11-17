Continue in this same conversation, with the **same character** (concept B: the cheerful sporty kid with the tousled brown hair, teal headband, teal top with the lighter flame-shaped panel, green shorts with a light stripe, teal sneakers with orange soles, teal wristbands). Thank you: the design is exactly what I wanted and I have integrated it in the app. I cleaned your sheets with a script, and this round fixes what I found. **If you no longer have the earlier sheets in this conversation, tell me and I will attach walk-cycle.png and run-cycle.png.** Keep the character 100 % identical (face, proportions, colours, outline weight, light from the top-left). Work in stages and wait for my "continue" between stages. Show every sheet.

## 1. WHAT I FOUND IN THE LAST SHEETS
1. **The walk and run cycles are not real loops.** Frames 1 to 8 were eight loosely related poses: frame 8 does not flow into frame 1, the two halves are not true left/right mirrors, the leg that is "forward" changes between frames, and the run cycle has no clear flight phase (both feet off the ground). Played in sequence they stutter.
2. **Frames are not registered.** The body shifts left and right and the character's height changes by up to 8 % between frames, so the animation jitters.
3. **The transparent background had coloured halos** (red, yellow, cyan fringes and loose specks around the figure, especially on the pose sheets with effects). I had to cut them off, which also trimmed some detail. **New rule for this round: do not give me transparency. Give me each sheet on a perfectly flat, solid #FF00FF (pure magenta) background**, no gradients, no shadows, no ground line, no glow, no semi-transparent effects, no magenta anywhere on the character (so I can key it out cleanly myself). Rays, sweat drops and similar effects must be solid opaque shapes.
4. Missing for the app: an "on your marks" crouch for the countdown, a real finish/celebration jump sequence, and idle/breathing loops.

## 2. REGISTRATION RULES (apply to every frame of every sheet)
- Cells are **512 x 512 px**, 4 columns x 2 rows per sheet (2048 x 1024). One animation per sheet unless I say otherwise.
- **The character stands on the same baseline in every frame**: the lowest sole pixel at y = 470 (in the cell), except in flight frames where the feet are above it. The **hips (the belt line) sit at the same x = 256** in every cycle frame; the body does not drift.
- **The same scale in every frame**: standing height from the sole to the top of the hair is 400 px (+- 3 %) in the standing poses; do not shrink or enlarge a frame to fit.
- A safe margin of at least 24 px inside every cell; nothing touches the cell edge.
- Camera: a flat side view facing **right** for walk and run (the same side-three-quarter you used).

## 3. STAGE 1 - TRUE LOOPING CYCLES (the most important)
1. **WALK LOOP, 8 frames, 1.2 s, seamless.** Standard walk cycle on the spot (the character does not travel): 1 right-foot contact (long stride), 2 down (weight on the right foot, the body at its lowest), 3 passing (the left leg swings through), 4 up (the body at its highest on the right toe), then 5 to 8 are **exact left/right mirrors of 1 to 4** (left-foot contact, down, passing, up). Arms swing in opposition to the legs, a slight forward lean, the headband tail trailing. **Frame 9 would be identical to frame 1**: show me a ninth tiny frame only in the check sheet to prove the loop closes.
2. **RUN LOOP, 8 frames, 0.7 s, seamless.** On the spot: 1 contact, 2 down (the lowest), 3 passing, 4 **flight** (both feet clearly off the ground, a high drive knee), then 5 to 8 the exact mirror (left contact, down, passing, flight). Forward lean about 10 degrees, arms at 90 degrees in opposition, hair and headband streaming back. Same registration rules; in the flight frames the body is higher but the hips stay on x = 256.
3. For each loop also give me a **check strip**: the 8 frames side by side at 25 % size, and an animated GIF or short video of the loop playing (looped 6 times) if your tool can make one, so I can see that it does not stutter. If a frame breaks the loop, regenerate it before showing me.

## 4. STAGE 2 - SHORT LOOPS AND SEQUENCES (one sheet each, 8 frames, same registration)
- **IDLE / BREATHING loop (4 frames used, 4 spare):** standing with hands on hips, a gentle chest rise, a small blink on frame 3.
- **WAVE loop (4 frames):** one hand waving, the other on the hip.
- **ON YOUR MARKS sequence (4 frames, for the 3-2-1-go countdown):** frame 1 stands ready, frame 2 crouches into a sprinter's start (hands on the ground, back knee down), frame 3 hips up ("set"), frame 4 launches into the first running stride.
- **JUMP FOR JOY sequence (6 frames):** anticipation crouch, take-off with arms up, the apex with a big laugh, the descent, the landing squash, and a final victory pose.
- **PANTING loop (4 frames):** hands on the knees, the chest rising, a sweat drop falling (solid opaque).
- **SLEEPING loop (2 to 4 frames):** lying on the side on the grass, head on the arm, the chest rising slowly, small solid "z" marks.
- **FINISH LINE (4 frames):** running through a finish tape (a simple solid ribbon, no text), arms up, then slowing down.

## 5. STAGE 3 - STATIC POSES AND EXPRESSIONS
Redo these on the same flat magenta background with the same registration (a pose sheet of 8 per image): holding a gold medal, lifting a trophy, standing on a winner step, pointing right, thinking, sitting hugging the knees, rain jacket and umbrella, stretching (side bend), a **thumbs-up**, a **"phone in hand" check-your-watch pose** and a **drinking water** pose. And one sheet of **8 head-and-shoulders expressions** (neutral, happy, laughing, effort, tired, surprised, proud, sleepy) at 512 x 512 each.

## 6. SELF-CHECK BEFORE YOU SEND (use your code tool and tell me the numbers)
For every cycle sheet compute and report, per frame: the sole baseline y, the hip x, the standing height, and the bounding box; the maximum deviation must be: baseline within +- 4 px (except flight frames), hip x within +- 6 px, height within +- 3 %. Check that frame 5 is a mirror of frame 1 (the limbs swapped, the same proportions) and that frame 8 leads smoothly into frame 1. Confirm the background is exactly #FF00FF with no other pixel of that colour on the character. Tell me honestly about anything that is off instead of hiding it.

## 7. WHAT I WILL DO WITH IT
I key out the magenta, scale, and play the frames as sprite strips in the app (walk 1.2 s, run 0.7 s, the jump and countdown as one-shot sequences, the loops while a screen is open), light and dark, with a still frame for users who turn animations off. So seamless loops and exact registration matter far more than extra detail.
