Continue in this same conversation, with the **same character** (concept B: the cheerful sporty kid, tousled brown hair, teal headband with a small tail, teal top with the lighter flame-shaped panel, green shorts with a light stripe, teal sneakers with orange soles, teal wristbands). Thank you for all the sheets so far. I have decided to stop asking for frame-by-frame cycles (they never form a seamless loop) and to **animate the character myself in code, like a paper puppet**: separate body parts that I rotate around their joints. So this round I need the character **disassembled into parts**, drawn completely, with exact joints. Work in stages, wait for my "continue", show every image, and tell me honestly about anything that is off.

## 1. HOW THE PUPPET WORKS (so you draw the parts correctly)
Every part is a flat picture. I will stack them and rotate each one around its **pivot** (a joint). When a limb rotates, the hidden end of the part moves into view, so **each part must be drawn complete to its joint, with a fully rounded joint end** (a circular cap), never cut off straight. The next part overlaps it, which hides the seam. Think "rubber-hose" limbs with round ends and generous overlap. The character is shown in a **flat side view facing right** (the same view as your walk cycle).

## 2. THE PARTS (14 parts, side view facing right, drawn at the SAME SCALE as the standing character of 400 px height)
Each part is drawn straight, in its **neutral hanging pose** (limbs hang straight down, the head upright), with the **pivot at the centre of the rounded end that attaches to the parent**:
1. **head**: the whole head with hair, headband, the ear and the face (side view), and a short neck stub. Pivot: the centre of the neck's lower end.
2. **headband-tail**: the little tail of the headband, hanging down from the knot, as its own part (it will flutter). Pivot: at the knot.
3. **torso**: the shirt including the near-side short sleeve stub, the belt line and the **shorts down to the hem**, ending at the hip line. Pivot: the hip centre (belt middle). The neck opening and shoulder positions must be clear.
4. **arm-near-upper**: the upper arm below the sleeve, to the elbow. Pivot: the shoulder (centre of the round top end). 5. **arm-near-lower**: the forearm, the wristband and the fist. Pivot: the elbow (centre of the round top end).
6. **arm-far-upper** and 7. **arm-far-lower**: the same for the far arm, drawn a little darker (about 12 % darker) because it is behind the body.
8. **leg-near-thigh**: from the shorts hem down to the knee (the part inside the shorts is drawn too, rounded at the hip end). Pivot: the hip (centre of the round top end). 9. **leg-near-shin**: the knee to the ankle with the sock line. Pivot: the knee. 10. **foot-near**: the sneaker, side view, with the ankle joint round at the top. Pivot: the ankle.
11. **leg-far-thigh**, 12. **leg-far-shin**, 13. **foot-far**: the same for the far leg, about 12 % darker.
14. **shadow**: a soft solid ellipse (opaque, flat colour #5B6770), no transparency (I will fade it myself).
Keep the identical drawing style, outline weight and colours in every part (a thin darker outline, light from the top-left). The outline must **close around each part** (also at the round joint ends), so the part looks finished when it rotates.

## 3. THE SHEET LAYOUT (strict, so I can cut it by program)
- ONE image of **2048 x 1536 px**, a grid of **4 columns x 3 rows**, cells of **512 x 512 px**, filling the cells in the order listed above, left to right, top to bottom (cell 15 and 16 stay empty).
- **Background: perfectly flat, solid #FF00FF (pure magenta)**, no gradients, no shadows, no semi-transparent effects, no magenta on the character. No text, no labels, no grid lines.
- **The pivot of every part is exactly at the centre of its cell (256, 256)**, and the part hangs **downward** from it (limbs, tail and torso extend down from the pivot; the head extends **up** from the neck pivot; the foot extends forward-right and down; the shadow is centred). Nothing may touch the cell edge (at least 20 px margin).
- **Mark each pivot with a small cross** in pure **#00FFFF (cyan)**, 9 x 9 px with 2 px thick lines, exactly at the cell centre, drawn on top of the part. It is the only cyan in the image, and I will remove it with a program.

## 4. THE ASSEMBLED REFERENCE (a second image)
Also give me one image, 1536 x 1024, on the same flat magenta background: the character **assembled from exactly these parts** in a neutral standing side view facing right (arms hanging, legs together, the far limbs behind the near ones), the sole baseline at y = 860, the hip (belt middle) at x = 768, standing height 400 px. It must look like your finished character and be made only of the parts above, so that I can align the parts to it. If a part does not fit, redraw the part and tell me.

## 5. SELF-CHECK BEFORE YOU SEND
Use your code tool to verify and report: (a) the sheet is exactly 2048 x 1536 and every cell's background is exactly #FF00FF outside the part; (b) in every cell there is exactly one cyan cross whose centre is at (256, 256) within +-3 px; (c) no part touches a cell edge; (d) the near and far versions of a part have the same silhouette shape; (e) the rounded joint end of each limb part is centred on the cross (the cross sits inside the round cap). Fix any failing cell before showing me.

## 6. STAGES
STAGE 1 = the 14-part sheet + the check numbers. STAGE 2 (after my "continue") = the assembled reference, a second set of the head part with 4 expressions (neutral, happy, effort, tired) in the same layout, and a hands set (open hand, fist, pointing, thumbs-up) as extra forearm parts, so I can change the face and the hands in code.
