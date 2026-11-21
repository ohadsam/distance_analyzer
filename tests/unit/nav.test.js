import test from 'node:test';
import assert from 'node:assert/strict';
import { resample, turnsOf, stepsOf, createNav, cueOf, newSaid, roundDist, lengthOf } from '../../web/js/nav.js';

// A route on a local grid: x east, y north (metres), converted to lat/lon around (32, 34.8).
const P = (x, y) => [32 + y / 111320, 34.8 + x / (111320 * Math.cos(32 * Math.PI / 180))];
const line = (pts, step = 10) => { const out = [P(...pts[0])]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step)); for (let k = 1; k <= n; k++) out.push(P(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)); } return out; };

test('resample: even spacing, ends included; a short or empty path gives nothing', () => {
  const r = resample(line([[0, 0], [300, 0]]), 15); assert.equal(r[0].s, 0); assert.ok(Math.abs(r[r.length - 1].s - 300) < 2); assert.ok(Math.abs(r[1].s - 15) < 0.5); assert.deepEqual(resample([P(0, 0)]), []); assert.deepEqual(resample(null), []);
});

test('turns: right, left, slight, sharp and U-turn are told apart; a straight line and GPS wobble give none', () => {
  assert.deepEqual(turnsOf(line([[0, 0], [500, 0]])), []);
  const right = turnsOf(line([[0, 0], [300, 0], [300, -300]])); assert.equal(right.length, 1); assert.equal(right[0].dir, 'right'); assert.ok(Math.abs(right[0].distM - 300) < 20);
  const left = turnsOf(line([[0, 0], [300, 0], [300, 300]])); assert.equal(left[0].dir, 'left');
  assert.equal(turnsOf(line([[0, 0], [300, 0], [560, -190]]))[0].dir, 'slight-right', '36 degrees');
  assert.equal(turnsOf(line([[0, 0], [300, 0], [100, 250]]))[0].dir, 'sharp-left', '~130 degrees');
  assert.equal(turnsOf(line([[0, 0], [300, 0], [300, 4], [0, 8]]))[0].dir, 'uturn');
  const wobble = [[0, 0]]; for (let i = 1; i <= 40; i++) wobble.push([i * 10, (i % 2 ? 3 : -3)]); assert.deepEqual(turnsOf(line(wobble.map((p) => p), 10)), [], 'under 30 degrees is not a turn');
  const two = turnsOf(line([[0, 0], [200, 0], [200, 200], [400, 200]])); assert.deepEqual(two.map((x) => x.dir), ['left', 'right']); assert.ok(two[0].distM < two[1].distM);
  const curve = []; for (let a = 0; a <= 90; a += 5) curve.push([200 + 60 * Math.sin(a * Math.PI / 180), -60 + 60 * Math.cos(a * Math.PI / 180)]); assert.equal(turnsOf(line([[0, 0], [200, 0], ...curve.map(([x, y]) => [x, y]), [260, -200]], 8)).length, 1, 'a rounded corner is one turn');
});

test('steps: start, each turn with the distance since the previous step, then arrival', () => {
  const path = line([[0, 0], [300, 0], [300, -300]]), turns = turnsOf(path), s = stepsOf(turns, lengthOf(path));
  assert.deepEqual(s.map((x) => x.type), ['start', 'turn', 'arrive']); assert.ok(Math.abs(s[1].distM - 300) < 20 && Math.abs(s[2].distM - 300) < 25);
  assert.deepEqual(roundDist(37), { value: 40, unit: 'm' }); assert.deepEqual(roundDist(240), { value: 250, unit: 'm' }); assert.deepEqual(roundDist(1260), { value: 1.3, unit: 'km' }); assert.deepEqual(roundDist(995), { value: 1, unit: 'km' });
});

test('following: next turn, what remains, off the route, back on it, arrival; a loop does not jump to its end', () => {
  const path = line([[0, 0], [300, 0], [300, -300], [0, -300], [0, 0]]), nav = createNav(path), at = (x, y) => nav.update({ lat: P(x, y)[0], lon: P(x, y)[1] });
  let s = at(50, 2); assert.equal(s.next.turn.dir, 'right'); assert.ok(Math.abs(s.next.distM - 250) < 25); assert.ok(Math.abs(s.remainingM - 1150) < 30); assert.equal(s.off, false); assert.equal(s.arrived, false);
  s = at(300, -150); assert.equal(s.next.turn.dir, 'right'); assert.ok(Math.abs(s.progressM - 450) < 25);
  s = at(150, 120); assert.equal(s.off, true, '120 m from the line'); assert.ok(s.offM > 100);
  s = at(150, -302); assert.equal(s.off, false); assert.ok(Math.abs(s.progressM - 750) < 30, 'back on the line');
  s = at(0, -150); assert.ok(Math.abs(s.progressM - 1050) < 30, 'the last side of the loop'); s = at(1, 3); assert.equal(s.arrived, true);
  const fresh = createNav(path).update({ lat: P(0, 2)[0], lon: P(0, 2)[1] }); assert.equal(fresh.arrived, false, 'standing at the start of a loop: it is not the finish'); assert.ok(fresh.remainingM > 1150);
});

test('spoken cues: once each, 200 m before and "now", off route (repeated every 30 s), back on, arrival', () => {
  const said = newSaid(), turn = { distM: 300, dir: 'right' }, st = (distM, o = {}) => ({ next: { turn, distM }, off: false, arrived: false, offM: 0, ...o });
  assert.equal(cueOf(st(400), said, 0), null); assert.deepEqual(cueOf(st(210), said, 0), { key: 'ahead', dir: 'right', distM: 210 }); assert.equal(cueOf(st(150), said, 0), null, 'said once');
  assert.deepEqual(cueOf(st(30), said, 0), { key: 'now', dir: 'right' }); assert.equal(cueOf(st(20), said, 0), null);
  assert.deepEqual(cueOf(st(100, { off: true, offM: 80 }), said, 1000), { key: 'off', distM: 80 }); assert.equal(cueOf(st(100, { off: true }), said, 5000), null); assert.equal(cueOf(st(100, { off: true }), said, 40000).key, 'off', 'repeated');
  assert.deepEqual(cueOf(st(100), said, 41000), { key: 'back' }); assert.equal(cueOf({ arrived: true }, said, 0).key, 'arrive'); assert.equal(cueOf({ arrived: true }, said, 1), null);
  const short = newSaid(); assert.deepEqual(cueOf(st(30), short, 0), { key: 'now', dir: 'right' }, 'a turn met without the early cue'); assert.equal(cueOf(st(150), short, 1), null, 'and the early cue is not said afterwards');
});
