// The puppet rig's motion (pure): joint angles of a side-view character (facing right) over one cycle of walking or running. Angles are CSS degrees:
// positive = clockwise, so a hanging limb swings BACK with a positive angle and FORWARD with a negative one. Every curve is periodic in the phase, so a loop
// is seamless by construction (phase 0 equals phase 1). The art (ui/puppet.js) is only the picture; this file is the animation.
export const PARTS = ['torso', 'head', 'tail', 'armNU', 'armNL', 'armFU', 'armFL', 'legNT', 'legNS', 'footN', 'legFT', 'legFS', 'footF', 'shadow'];
export const CYCLE = {
  walk: { ms: 1200, thigh: 22, knee: 32, arm: 20, elbow: 22, lean: 3, bob: 3, tail: 10 },
  run: { ms: 700, thigh: 44, knee: 85, arm: 38, elbow: 78, lean: 10, bob: 7, tail: 22 },
};
const TAU = Math.PI * 2, r1 = (v) => Math.round(v * 100) / 100 + 0; // (+ 0 turns -0 into 0)

/** One leg at its own phase p: thigh, knee flexion (shin) and ankle (foot), in degrees. The knee bends while the leg swings forward. */
function leg(c, p) {
  const thigh = -c.thigh * Math.sin(TAU * p), knee = c.knee * Math.max(0, Math.cos(TAU * p)) ** 1.4, foot = -0.55 * (thigh + knee);
  return { thigh, knee, foot };
}
/** All joint angles for `kind` ('walk' | 'run') at `phase` in [0, 1): { torso: { r, y }, head: { r }, ..., shadow: { s } }. The far leg is half a cycle behind; each arm swings against the leg on its own side. */
export function pose(kind, phase) {
  const c = CYCLE[kind === 'run' ? 'run' : 'walk'], p = phase - Math.floor(phase), N = leg(c, p), F = leg(c, p + 0.5);
  const arm = (q) => { const up = c.arm * Math.sin(TAU * q); return { up, low: -(c.elbow + 0.45 * Math.max(0, -up)) }; }; // elbow bends more when the arm is forward
  const aN = arm(p), aF = arm(p + 0.5), bob = -c.bob * Math.cos(2 * TAU * p) * 0.5 - c.bob * 0.5, up01 = (1 - Math.cos(2 * TAU * p)) / 2; // bob < 0 = body up; highest while the legs pass
  const out = {
    torso: { r: c.lean + 0.8 * Math.sin(2 * TAU * p), y: bob }, head: { r: -0.55 * c.lean + 1.2 * Math.sin(2 * TAU * p + 0.8) }, tail: { r: c.tail * Math.sin(2 * TAU * p - 1.1) },
    armNU: { r: aN.up }, armNL: { r: aN.low }, armFU: { r: aF.up }, armFL: { r: aF.low },
    legNT: { r: N.thigh }, legNS: { r: N.knee }, footN: { r: N.foot }, legFT: { r: F.thigh }, legFS: { r: F.knee }, footF: { r: F.foot }, shadow: { s: 1 - 0.07 * (kind === 'run' ? 1.6 : 1) * up01 }, // the shadow shrinks while the body is up
  };
  for (const k of Object.keys(out)) for (const f of Object.keys(out[k])) out[k][f] = r1(out[k][f]);
  return out;
}
/** `n` evenly spaced samples of the loop as WAAPI keyframes per part (the last sample equals the first, so the loop closes): { part: [{ transform }, ...] }. */
export function keyframes(kind, n = 32) {
  const out = Object.fromEntries(PARTS.map((k) => [k, []]));
  for (let i = 0; i <= n; i++) {
    const pz = pose(kind, i / n);
    for (const k of PARTS) {
      const v = pz[k]; out[k].push({ transform: k === 'torso' ? `translateY(${v.y}px) rotate(${v.r}deg)` : k === 'shadow' ? `scaleX(${v.s})` : `rotate(${v.r}deg)` });
    }
  }
  return out;
}
