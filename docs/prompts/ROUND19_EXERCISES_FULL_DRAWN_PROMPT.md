Continue in this same conversation with the **approved Concept B character** (the cheerful sporty kid with the tousled brown hair, teal headband with a tail, teal top with the lighter flame-shaped panel, green shorts with a light stripe, teal sneakers with orange soles, teal wristbands). **The character design is approved and must not change.** The parts-and-rig method did not work: rotating separate body parts makes the character look stiff and odd (broken shoulders, distorted shorts, no real posture). **Please go back to drawing the WHOLE character in every pose with your image generation, exactly like the approved `walk-cycle.png` and `run-cycle.png`, which looked right.** Use image generation for all artwork; use code only to cut, align, clean, validate and package. Never claim a file or a check that did not really happen; if something cannot be done, say exactly what and deliver what is usable.

## 1. HOW (this is what makes it consistent)
- **One exercise = ONE image with 6 full-figure poses in a 3 x 2 grid** (6 consecutive frames of the loop), flat #FF00FF background, no text, no ground, no shadows, the same figure size and the same baseline in every cell, the same character in every cell. I will play the 6 frames in a loop (each held about 2 frames), so every frame must be a clearly different, correct step of the movement and the **last frame must flow back into the first**. Generate the whole 6-pose grid in one go so the sequence stays consistent; if one pose is wrong, regenerate that exercise, not the character.
- Look at the approved model sheet and the walk/run sheets before each exercise and keep the same proportions, outline weight, colours and light from the top left. The face: cheerful for warm-ups, calm effort for stretches.
- Views: side view facing **right** for the side exercises, front view for the front ones (listed below). Same view for the whole loop.
- Anatomy matters: neutral spine, knees not collapsing inward, no hyper-extended joints, no bouncing in static stretches. **You cannot certify anatomy; list the postures you want a physiotherapist to confirm.**

## 2. THE 24 EXERCISES: the 6 poses of each (frame 1 to 6; the loop returns from 6 to 1)
**Warm-up (cheerful face):**
- `wu_march` (side): 1 stand, 2 right knee rising, 3 right knee at hip height with the opposite arm forward, 4 right foot down, 5 left knee at hip height with the opposite arm forward, 6 left foot down.
- `wu_leg_swing` (side, one hand on an imaginary wall in front): 1 leg down, 2 leg swinging forward, 3 leg forward at hip height (straight), 4 leg back past the body, 5 leg far back, 6 leg returning.
- `wu_high_knees` (side): jogging on the spot, knees to hip height, arms bent at 90 degrees, a small hop: 1 right knee up, 2 right foot landing, 3 both low (in the air), 4 left knee up, 5 left foot landing, 6 both low.
- `wu_butt_kicks` (side): jogging on the spot, heels kicked up to the buttocks: right heel up, down, left heel up, down (6 frames, small hops, arms bent).
- `wu_walking_lunge` (side): 1 stand, 2 big step forward, 3 back knee lowering toward the floor, 4 lowest (front shin vertical, torso upright), 5 pushing up, 6 feet together.
- `wu_hip_circles` (front, hands on the hips): the hips drawing a big circle: hips far left, forward, far right, back, with the head and shoulders almost still; the circle must be clearly visible at 96 px.
- `wu_arm_circles` (front): both arms drawing big circles, six positions around the circle (down, out, up, overhead, behind, down).
- `wu_ankle_rolls` (side or three-quarter): standing on one leg, the other foot lifted slightly, the toes drawing a clear circle in six positions.
- `wu_side_steps` (front): light side steps with a small squat: stand, step right, squat, together, step left, squat.
- `wu_calf_raises` (side): heels down, rising, on the toes (top), hold, lowering, down. The heel must visibly leave the ground.
- `wu_torso_twist` (front, arms out at shoulder height): the torso twisting left and right with the arms following, the shoulder line narrowing at the extremes; six positions centre, left, far left, centre, right, far right.
- `wu_skips` (side): light A-skips: a knee drive with a small hop on the other leg, alternating, arms swinging opposite.
**Cool-down (calm effort face; static stretches: frame 1 = entering, frames 2 to 5 = the stretch held with a tiny breathing change, 6 = returning; no bouncing):**
- `cd_walk` (side): a slow relaxed walk, arms loose, six phases of a walk cycle.
- `cd_quad` (side): standing on one leg, the other knee bent so the heel reaches the buttock, the knee pointing down, **the hand gripping the ankle** (clearly touching), the other hand on an imaginary wall, torso upright.
- `cd_hamstring` (side): one heel forward on the ground with the **toes up and the leg straight**, the other knee slightly bent, hips back, a flat back hinging forward, both hands sliding down the front shin.
- `cd_calf` (side): both hands on an imaginary wall at chest height, the back leg straight with the heel down, the front knee bent, the body in one diagonal line.
- `cd_hip_flexor` (side): a low lunge, the back knee near the ground, the front knee over the ankle, hips pushed forward, torso upright, hands on the hips.
- `cd_glute` (side): standing figure-4: the ankle resting on the opposite knee (clear contact), sitting back with the standing knee bent, hands forward for balance.
- `cd_it_band` (front): legs crossed (one in front of the other, feet close), one arm overhead, leaning sideways away from the crossed leg.
- `cd_adductor` (front): a wide stance, one knee bent into a side lunge, the other leg straight with the toes forward, hands on the bent thigh.
- `cd_shoulder` (front): one arm straight across the chest, the other hand pulling it at the elbow.
- `cd_chest` (side or three-quarter): the hands **clasped behind the back**, the arms straight and lifted slightly, the chest open, the head up.
- `cd_back_fold` (side): a gentle forward fold from the hips with soft knees, hands to the shins, head relaxed, the whole figure inside the frame.
- `cd_breathing` (front): standing, the arms rising out to the sides and overhead on the inhale and lowering on the exhale (frames 1 to 3 up, 4 to 6 down), shoulders relaxed.

## 3. TECHNICAL RULES (the cells will be cut by code)
Every cell is square (the grid image about 1536 x 1024: each cell 512 x 512), the background exactly #FF00FF (255, 0, 255) with no gradient or noise, the figure fully inside its cell with at least 16 px of margin on every side, the lowest foot pixel on the same row in every cell where a foot should be on the ground, a standing figure about 400 px tall from sole to the top of the hair, **the same scale in every cell** (a lunge or a fold is lower, the body is not shrunk), the figure centred on the same x (side views: hips at the centre). No pink fringe on the edges. Do not put any labels or numbers in the picture.

## 4. STAGES (wait for my "continue" between the stages)
**STAGE 1 - three tests:** `wu_high_knees`, `cd_quad`, `cd_breathing`. For each: the 3 x 2 grid image, the 6 cells as separate files `ex_<id>_01.png` ... `ex_<id>_06.png` (512 x 512, exact #FF00FF), a GIF preview that loops the 6 frames at the exercise's own tempo, and a **96 px and a 56 px version on white and on #161C22**. Report real measurements (border pixels not exactly the key colour, pinkish pixels, lowest foot row per cell, bounding-box height of the standing cell, margin, the frame-to-frame change including 6 to 1), and tell me honestly what is off. **Do not continue until I approve.**
**STAGE 2 - the 11 remaining warm-up exercises (two ZIPs). STAGE 3 - the 11 remaining cool-down exercises (two ZIPs).** Same files. Each ZIP under 20 MB. One README per ZIP with the measurements and the list of postures for a physiotherapist.
