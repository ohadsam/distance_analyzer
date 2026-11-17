import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pose, keyframes, PARTS, CYCLE } from '../../web/js/puppetRig.js';

test('the loop is seamless: phase 0 and phase 1 are the same pose, and so are the first and last keyframes', () => {
  for (const kind of ['walk', 'run']) {
    assert.deepEqual(pose(kind, 0), pose(kind, 1), kind);
    const kf = keyframes(kind, 32); for (const part of PARTS) { assert.equal(kf[part].length, 33); assert.deepEqual(kf[part][0], kf[part][32], `${kind} ${part}`); }
  }
});
test('the far leg is half a cycle behind the near leg, and each arm swings against the leg on its own side', () => {
  for (const kind of ['walk', 'run']) for (const p of [0, 0.13, 0.25, 0.4, 0.6, 0.9]) {
    const a = pose(kind, p), b = pose(kind, p + 0.5);
    assert.equal(a.legNT.r, b.legFT.r, `${kind} thigh at ${p}`); assert.equal(a.legNS.r, b.legFS.r, `${kind} knee at ${p}`); assert.equal(a.footN.r, b.footF.r); assert.equal(a.armNU.r, b.armFU.r);
    assert.ok(a.legNT.r * a.armNU.r <= 0.0001, `near arm swings against the near leg at ${p}`); // the arm is forward (negative) when the same-side leg is back (positive)
  }
});
test('angles stay in a sane range and the knee only bends one way', () => {
  for (const kind of ['walk', 'run']) { const c = CYCLE[kind]; for (let i = 0; i < 200; i++) { const p = pose(kind, i / 200); assert.ok(Math.abs(p.legNT.r) <= c.thigh + 0.01); assert.ok(p.legNS.r >= -0.01 && p.legNS.r <= c.knee + 0.01); assert.ok(p.armNL.r <= 0.01 && p.armNL.r >= -(c.elbow * 1.5)); assert.ok(p.shadow.s > 0.8 && p.shadow.s <= 1.01); } }
});
test('running is faster and bigger than walking', () => { assert.ok(CYCLE.run.ms < CYCLE.walk.ms); assert.ok(CYCLE.run.thigh > CYCLE.walk.thigh && CYCLE.run.knee > CYCLE.walk.knee && CYCLE.run.lean > CYCLE.walk.lean); });
