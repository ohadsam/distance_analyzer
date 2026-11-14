import test from 'node:test';
import assert from 'node:assert/strict';
import { haversine } from '../../web/js/geo.js';
import { newWorkout, addFix, pause, resume, finish, elapsedMs, avgPaceSec, recentPaceSec, kcal, summarize, sanitizeWorkout, LIMITS } from '../../web/js/workout.js';

// 1 degree of latitude ~ 111.195 km; a runner at 3 m/s heading north, one fix per second.
const north = (m) => 32 + m / 111195;
const fix = (m, t, acc = 5) => ({ lat: north(m), lon: 34.8, t, acc });

test('haversine: one degree of latitude and symmetry', () => {
  assert.ok(Math.abs(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 111195) < 100);
  const a = { lat: 32, lon: 34 }, b = { lat: 32.1, lon: 34.2 }; assert.equal(haversine(a, b), haversine(b, a)); assert.equal(haversine(a, a), 0);
});
test('distance, moving time, pace and km splits from a steady 3 m/s run', () => {
  const w = newWorkout('run', 0);
  for (let s = 0; s <= 1100; s++) assert.ok(addFix(w, fix(3 * s, s * 1000)));
  assert.ok(Math.abs(w.distanceM - 3300) < 15); assert.equal(w.splits.length, 3);
  assert.ok(Math.abs(w.splits[0].atMs - 333000) < 2000, `split1 ${w.splits[0].atMs}`);
  assert.ok(Math.abs(avgPaceSec(w) - 333) < 3); assert.ok(Math.abs(recentPaceSec(w) - 333) < 5);
});
test('bad fixes are rejected: low accuracy, teleport, out of order, invalid, paused', () => {
  const w = newWorkout('walk', 0); assert.ok(addFix(w, fix(0, 0)));
  assert.equal(addFix(w, fix(10, 1000, 80)), false); assert.equal(addFix(w, fix(500, 2000)), false); assert.equal(addFix(w, fix(5, 0)), false);
  assert.equal(addFix(w, { lat: NaN, lon: 1, t: 5000 }), false); assert.equal(addFix(w, { lat: 91, lon: 1, t: 5000 }), false);
  pause(w, 3000); assert.equal(addFix(w, fix(10, 4000)), false);
});
test('standing still adds nothing; a pause adds no distance across the gap and is not counted in time', () => {
  const w = newWorkout('walk', 0); addFix(w, fix(0, 0)); for (let s = 1; s <= 10; s++) addFix(w, fix(0.3 * (s % 2), s * 1000)); // GPS jitter while standing
  assert.ok(w.distanceM < 1 && w.movingMs === 0);
  pause(w, 20000); resume(w, 80000); assert.equal(elapsedMs(w, 90000), 30000);
  addFix(w, fix(1000, 81000, 5)); assert.ok(w.distanceM < 1, 'no 1 km jump across the pause'); addFix(w, fix(1003, 82000)); assert.ok(Math.abs(w.distanceM - 3) < 0.5);
});
test('finish closes the workout and resumes a pending pause; summary is compact; kcal uses MET', () => {
  const w = newWorkout('run', 1000); addFix(w, fix(0, 1000)); addFix(w, fix(3, 2000)); pause(w, 3000); finish(w, 9000);
  assert.equal(w.endedAt, 9000); assert.equal(elapsedMs(w, 99999), 8000 - 6000, 'paused 3000-9000 is not counted: 1000..3000 = 2000');
  const big = newWorkout('run', 0); big.movingMs = 3600000; assert.equal(kcal(big, 70), 686); assert.equal(kcal({ kind: 'walk', movingMs: 3600000 }), 245);
  assert.deepEqual(Object.keys(summarize(w)).sort(), ['distanceM', 'endedAt', 'kind', 'movingMs', 'points', 'splits', 'startedAt']);
});
test('sanitizeWorkout clamps hostile records and drops bad points', () => {
  assert.equal(sanitizeWorkout(null), null); assert.equal(sanitizeWorkout({ kind: 'run' }), null);
  const r = sanitizeWorkout({ kind: '__proto__', startedAt: 1e9, distanceM: 1e99, movingMs: -5, points: [[1, 2, 3], [999, 2, 3], 'x', [1, 2]], splits: [{ km: 1, atMs: 5 }, { km: 'a' }], extra: 1 });
  assert.equal(r.kind, 'walk'); assert.equal(r.distanceM, 1e7); assert.equal(r.movingMs, 0); assert.deepEqual(r.points, [[1, 2, 3]]); assert.equal(r.splits.length, 1); assert.equal('extra' in r, false);
  assert.equal(sanitizeWorkout({ startedAt: 5, points: new Array(LIMITS.maxPoints + 10).fill([1, 1, 1]) }).points.length, LIMITS.maxPoints);
});
