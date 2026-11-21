Continue in this same conversation, with the **same character** (concept B: the cheerful sporty kid with the tousled brown hair, teal headband, teal top with the lighter flame-shaped panel, green shorts with a light stripe, teal sneakers with orange soles, teal wristbands). **If you no longer have the earlier sheets in this conversation, tell me now and I will attach these reference files again: `model-sheet.png` (turnaround, palette, expressions), `concept-B.png`, `walk-cycle.png`, `run-cycle.png`, `poses-1.png`, `poses-2.png` (the poses include "stretch").** Keep the character 100 % identical (face, proportions, colours, outline weight, light from the top left). Use your image-generation and code tools; if you cannot generate images or measure them, tell me now and stop.

## 1. WHAT THIS IS FOR
StepUp (a walking and running app, Hebrew first / English) is adding **guided warm-up exercises before a run or walk** and **cool-down and stretching exercises after it**. Each exercise is shown as a **small looping animation of this same character** performing it correctly, next to a short text. They play at 96 px to 200 px on a light and on a dark background, so the **pose must read clearly at that size**: a big readable body line, the working limb clearly visible, no tiny details.

## 2. THE EXERCISES (12 + 12, one loop each)
**Warm-up (dynamic, 30-45 s each in the app):**
1. `wu_march` - marching on the spot, knees to hip height, arms swinging.
2. `wu_leg_swing` - holding an imaginary wall with one hand, swinging one leg forward and back (side view).
3. `wu_high_knees` - jogging on the spot with high knees.
4. `wu_butt_kicks` - jogging on the spot, heels to the buttocks.
5. `wu_walking_lunge` - a slow walking lunge: step forward, back knee down, rise (side view).
6. `wu_hip_circles` - hands on hips, drawing big circles with the hips (front or three-quarter view).
7. `wu_arm_circles` - big forward arm circles (front view).
8. `wu_ankle_rolls` - standing on one foot, rolling the other ankle (a clear toe-circle).
9. `wu_side_steps` - light side steps with a small squat (front view).
10. `wu_calf_raises` - rising up on the toes and down (side view).
11. `wu_torso_twist` - arms out, gentle torso twist left and right (front view).
12. `wu_skips` - light skipping (A-skips) on the spot.
**Cool-down / stretches (static, 20-30 s each; the loop is a slow breathing hold with a small, clear movement into and out of the stretch):**
1. `cd_walk` - a slow relaxed walk, arms loose, deep breaths.
2. `cd_quad` - standing quad stretch: one heel to the buttock, holding the ankle, other hand on an imaginary wall.
3. `cd_hamstring` - hamstring stretch: one heel forward on the ground, toes up, hinge from the hips with a flat back.
4. `cd_calf` - calf stretch against an imaginary wall, back leg straight with the heel down.
5. `cd_hip_flexor` - low lunge hip-flexor stretch, back knee on the ground, hips pushed forward.
6. `cd_glute` - standing figure-4 glute stretch (ankle on the opposite knee, sit back).
7. `cd_it_band` - standing cross-leg side bend stretch (arm overhead leaning away).
8. `cd_adductor` - wide-stance side lunge, groin / inner thigh stretch.
9. `cd_shoulder` - cross-body shoulder stretch (front view).
10. `cd_chest` - hands clasped behind the back, chest open, shoulder blades together.
11. `cd_back_fold` - gentle forward fold, hands to the shins, knees soft.
12. `cd_breathing` - standing, arms rising on the inhale and lowering on the exhale (slow, calm).
Each exercise must be **anatomically correct** (a physiotherapist should accept the posture): neutral spine, knees not collapsing inward, no locked or hyper-extended joints, no bouncing in the static stretches.

## 3. REGISTRATION RULES (apply to every frame of every set - these were the problems in earlier rounds)
- **12 frames per exercise, 512 x 512 px, played at 8 frames per second = a 1.5 second loop.** The loop must be **seamless**: the change from frame 12 to frame 01 must be as small as between any two other neighbouring frames.
- **Background exactly #FF00FF (255, 0, 255)**, flat, no gradient, no shadow on it, no noise. No transparency (it gave coloured halos before). No ground shadow, no props, no text, no logos.
- **The character stands on the same baseline in every frame and in every set**: the lowest point of the support foot at y = 470; the body centred at x = 256 (for side views the hips at x = 256). **The same scale everywhere**: a standing figure from the sole to the top of the hair is 400 px (+- 3 %). A lunge or a fold is lower, but the **scale of the body parts stays the same** (do not shrink or enlarge a frame to fit).
- **Identical character in every frame** (colours, proportions, outline weight, face; the face expression is a calm effort for stretches and a cheerful one for warm-ups). Light from the top left in all frames.
- **View**: side view facing **right** for the exercises that need it (lunge, leg swing, calf raises, quad, hamstring, calf, hip flexor, glute), front or three-quarter view for the others as listed. Keep the same view for the whole loop.
- **Calm and safe**: no flashing, no abrupt changes, nothing faster than a normal exercise tempo; the still first frame must already show the exercise clearly.
- **Original work only** and consistent with the earlier sheets. Tell me honestly whether you consider the files free to use (CC0) - I will not assume it.

## 4. STAGES (wait for my "continue" between the stages)
1. **STAGE 1 - ONE test exercise per group** (`wu_high_knees` and `cd_quad`): the 12 frames of each, the 4 x 3 contact sheet, the measurements of section 6 and **a 96 px version on white and on #161C22 side by side**. I will check the look and the registration before you do the rest.
2. **STAGE 2 - the 11 remaining warm-up exercises**, delivered in **two zip files** (6 + 5).
3. **STAGE 3 - the 11 remaining cool-down exercises**, in **two zip files** (6 + 5).

## 5. THE FILES (for each exercise)
`ex_<id>_01.png` ... `ex_<id>_12.png` (512 x 512, exact #FF00FF background), `ex_<id>_sheet.png` (the 12 frames in a 4 x 3 grid, 2048 x 1536), `<id>_preview.gif` (8 fps, for my eyes only), and **one `README.txt` per zip** with the measurements below. Name the ids exactly as in section 2.

## 6. SELF-CHECK BEFORE YOU SEND (use your code tool; write the real numbers in the README; do not write "not verified" for something you can measure)
For every exercise: the smallest / largest mean absolute change between neighbouring frames (0-255) and the frame 12 -> 01 value (targets: smallest at least **1.5**, largest at most **14**, the loop-closing value no bigger than the largest neighbouring change); the number of pixels in the 6 px border that are not exactly (255, 0, 255) (**0**); the number of "pinkish" pixels (red and blue each more than 40 above green) outside the intended colours on the figure (**0**); the lowest foot pixel row in every frame (the support foot at y = 470 +- 2); the figure's bounding-box height in a neutral frame (400 px +- 3 % for standing exercises); the horizontal position of the hips in every frame (256 +- 6); the biggest brightness change between neighbouring frames (<= 10 %). Also tell me honestly anything that is off: a deformed limb, a clipped hand or foot at the border, a jump at the loop point, a colour that changes, a posture a physiotherapist would correct. If a number misses its target, **fix it and measure again** before you send.

## 7. WHAT I WILL DO WITH IT
I key out the magenta, crop all frames to one common box, scale them to 128 x 128, cut a strip of 12 frames per exercise (WebP with transparency) and play it with steps() at 1.5 s per loop beside the exercise text, in light and dark, with a "calm" switch that shows the still first frame. So a clean loop, exact registration, a flat magenta and a clear, correct posture at a small size matter more than detail.
