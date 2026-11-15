import test from 'node:test';
import assert from 'node:assert/strict';
import { createStepDetector, createCadence, rhythmHint, CAD } from '../../web/js/cadence.js';
import { beatsBetween, breathAt, lungAt } from '../../web/js/metronome.js';
import { runSignal } from './_signal.js';

function drive(samples, cad, det = createStepDetector()) {
  const steps = []; let nextTick = 0, last = 0;
  for (const [t, x, y, z] of samples) { const s = det(t, x, y, z); if (s) { steps.push(s); cad.step(s); } if (t >= nextTick) { cad.tick(t); nextTick = t + 1000; } last = t; }
  return { steps, last };
}

test('step detector finds ~168 steps/min in a clean signal', () => {
  const det = createStepDetector(), steps = [];
  for (const [t, x, y, z] of runSignal({ toMs: 20000, gapMs: 357 })) { const s = det(t, x, y, z); if (s) steps.push(s); }
  const gaps = steps.slice(1).map((s, i) => s - steps[i]), avg = gaps.reduce((a, b) => a + b) / gaps.length;
  assert.ok(Math.abs(60000 / avg - 168) < 4, `cadence ${60000 / avg}`); assert.ok(steps.length > 50);
});
test('step detector ignores a flat signal and shaking weaker than the threshold', () => {
  const det = createStepDetector(); let n = 0;
  for (const [t, x, y, z] of runSignal({ toMs: 10000, gapMs: 357, amp: 0.3 })) if (det(t, x, y, z)) n++;
  assert.equal(n, 0);
});
test('metronome stays silent while learning, then locks on a steady rhythm', () => {
  const cad = createCadence(0); cad.start(0);
  const sig = runSignal({ toMs: 40000, gapMs: 357, jitter: 8 });
  let lockedAt = 0, silentBefore = true;
  const det = createStepDetector(); let nextTick = 0;
  for (const [t, x, y, z] of sig) {
    const s = det(t, x, y, z); if (s) cad.step(s); if (t >= nextTick) { cad.tick(t); nextTick = t + 1000; }
    if (cad.snapshot.state === 'locked' && !lockedAt) lockedAt = t;
    if (t < CAD.learnMs && cad.snapshot.state === 'locked') silentBefore = false;
  }
  assert.ok(silentBefore, 'must not sound during the learning window');
  assert.ok(lockedAt >= CAD.learnMs && lockedAt < 32000, `locked at ${lockedAt}`);
  assert.ok(Math.abs(cad.snapshot.bpm - 168) <= 3, `bpm ${cad.snapshot.bpm}`);
});
test('an irregular rhythm never locks', () => {
  const cad = createCadence(0); cad.start(0);
  drive(runSignal({ toMs: 60000, gapMs: 357, jitter: 140, seed: 7 }), cad);
  assert.equal(cad.snapshot.state, 'learning');
});
test('stopping goes back to silent learning; a manual rhythm is kept', () => {
  const cad = createCadence(0); cad.start(0);
  const { last } = drive(runSignal({ toMs: 35000, gapMs: 400 }), cad);
  assert.equal(cad.snapshot.state, 'locked'); assert.ok(Math.abs(cad.snapshot.bpm - 150) <= 3);
  cad.tick(last + CAD.lostMs + 1000); assert.equal(cad.snapshot.state, 'learning'); assert.equal(cad.snapshot.bpm, 0);
  const m = createCadence(0); m.start(0); m.setManual(172); m.tick(60000); assert.equal(m.snapshot.state, 'locked'); assert.equal(m.snapshot.bpm, 172);
  m.setManual(999); assert.equal(m.snapshot.bpm, CAD.maxBpm);
});
test('a clearly new steady cadence re-locks only after a while', () => {
  const cad = createCadence(0); cad.start(0); const det = createStepDetector();
  const a = drive(runSignal({ toMs: 35000, gapMs: 400 }), cad, det); assert.ok(Math.abs(cad.snapshot.bpm - 150) <= 3);
  drive(runSignal({ fromMs: a.last, toMs: a.last + 8000, gapMs: 340 }), cad, det);
  assert.ok(Math.abs(cad.snapshot.bpm - 150) <= 3, 'not yet');
  drive(runSignal({ fromMs: a.last + 8000, toMs: a.last + 40000, gapMs: 340 }), cad, det);
  assert.ok(Math.abs(cad.snapshot.bpm - 176) <= 4, `bpm ${cad.snapshot.bpm}`);
});
test('rhythmHint', () => { assert.equal(rhythmHint(170, 171), 'on'); assert.equal(rhythmHint(170, 180), 'fast'); assert.equal(rhythmHint(170, 160), 'slow'); assert.equal(rhythmHint(0, 160), ''); });

test('beatsBetween is exact and gap-free across windows', () => {
  const a = beatsBetween(1000, 120, 1000, 3100); assert.deepEqual(a.map((b) => b.t), [1000, 1500, 2000, 2500, 3000]); assert.equal(a[4].i, 4);
  const b = [...beatsBetween(1000, 120, 1000, 2100), ...beatsBetween(1000, 120, 2100, 3100)]; assert.deepEqual(b.map((x) => x.i), [0, 1, 2, 3, 4, 5].slice(0, b.length));
});
test('security: an untrusted breathing pattern key falls back to the default instead of reading the prototype', () => {
  assert.equal(breathAt(0, '__proto__').phase, 'in'); assert.equal(lungAt(1, 'constructor'), 1 / 3);
});
test('breathing pattern 3:2 cycles in-in-in-out-out', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => breathAt(i, '3:2').phase), ['in', 'in', 'in', 'out', 'out', 'in']);
  assert.equal(breathAt(0, '3:2').first, true); assert.equal(breathAt(5, '3:2').first, true); assert.equal(breathAt(3, 'off').phase, 'none');
  assert.equal(lungAt(0, '3:2'), 0); assert.equal(lungAt(3, '3:2'), 1); assert.equal(lungAt(5, '3:2'), 0); assert.ok(lungAt(4, '3:2') === 0.5);
});

import { visualDivisor } from '../../web/js/ui/rhythm.js';
test('the visual pulse never exceeds 75 a minute (flash safety): a divisor of the real cadence', () => {
  assert.equal(visualDivisor(60), 1); assert.equal(visualDivisor(75), 1); assert.equal(visualDivisor(170), 3); assert.equal(visualDivisor(0), 1);
  for (const bpm of [90, 120, 150, 170, 190, 230]) assert.ok(bpm / visualDivisor(bpm) <= 75, String(bpm));
});
