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
  assert.deepEqual(Object.keys(summarize(w)).sort(), ['distanceM', 'elapsedMs', 'endedAt', 'kind', 'movingMs', 'points', 'splits', 'startedAt']);
});
test('sanitizeWorkout clamps hostile records and drops bad points', () => {
  assert.equal(sanitizeWorkout(null), null); assert.equal(sanitizeWorkout({ kind: 'run' }), null);
  const r = sanitizeWorkout({ kind: '__proto__', startedAt: 1e9, distanceM: 1e99, movingMs: -5, points: [[1, 2, 3], [999, 2, 3], 'x', [1, 2]], splits: [{ km: 1, atMs: 5 }, { km: 'a' }], extra: 1 });
  assert.equal(r.kind, 'walk'); assert.equal(r.distanceM, 1e7); assert.equal(r.movingMs, 0); assert.deepEqual(r.points, [[1, 2, 3]]); assert.equal(r.splits.length, 1); assert.equal('extra' in r, false);
  assert.equal(sanitizeWorkout({ startedAt: 5, points: new Array(LIMITS.maxPoints + 10).fill([1, 1, 1]) }).points.length, LIMITS.maxPoints);
});

test('regression: pace after a long pause uses only fixes since the resume', () => {
  const w = newWorkout('run', 0); for (let s = 0; s <= 40; s++) addFix(w, fix(3 * s, s * 1000));
  pause(w, 41000); resume(w, 400000); assert.equal(recentPaceSec(w), 0, 'no stale window across the pause');
  for (let s = 0; s <= 20; s++) addFix(w, fix(500 + 3 * s, 400000 + s * 1000)); assert.ok(Math.abs(recentPaceSec(w) - 333) < 8, `pace ${recentPaceSec(w)}`);
});
test('regression: finishing while paused does not count the pause, and the record keeps wall-clock time', () => {
  const w = newWorkout('walk', 0); pause(w, 10000); finish(w, 50000);
  assert.equal(elapsedMs(w, 99999), 10000); assert.equal(summarize(w).elapsedMs, 10000);
});

import { stoppedFor } from '../../web/js/workout.js';
test('stoppedFor: barely moved over ~30 s with a fresh fix -> offer a pause; moving, stale, too short or paused -> no', () => {
  const mk = (pts, extra = {}) => ({ recent: pts, pausedAt: 0, endedAt: 0, ...extra }), T = 1_000_000;
  const still = [[32, 34.8, T], [32.000002, 34.8, T + 10000], [32.000003, 34.800001, T + 20000], [32.000002, 34.8, T + 31000]];
  assert.equal(stoppedFor(mk(still), T + 33000), true);
  assert.equal(stoppedFor(mk(still), T + 60000), false, 'the last fix is old: the GPS may be lost, not the person');
  assert.equal(stoppedFor(mk(still.slice(0, 3)), T + 21000), false, 'under 28 s of data');
  assert.equal(stoppedFor(mk([[32, 34.8, T], [32.0005, 34.8, T + 15000], [32.001, 34.8, T + 31000]]), T + 32000), false, 'moving at walking pace');
  assert.equal(stoppedFor(mk(still, { pausedAt: T }), T + 33000), false); assert.equal(stoppedFor(mk([]), T), false);
});

import { readFileSync } from 'node:fs';
test('the Android kilometre counter uses the same limits as the page (so spoken and shown splits agree)', () => {
  const kt = readFileSync('android/app/src/main/java/com/stepup/app/SplitTracker.kt', 'utf8');
  assert.ok(kt.includes(`acc > ${LIMITS.maxAccuracyM}f`), 'accuracy limit'); assert.ok(kt.includes(`v <= ${LIMITS.maxSpeedMps}.0`), 'speed limit'); assert.ok(kt.includes(`v >= ${LIMITS.movingMps}`), 'moving limit');
});
