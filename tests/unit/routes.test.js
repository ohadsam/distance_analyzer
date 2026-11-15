import test from 'node:test';
import assert from 'node:assert/strict';
import { simplify, pathLength, sampleAlong, distToPath, makeRoute, matchRoute, distanceAtTime, sanitizeRoute } from '../../web/js/route.js';
import { attemptsOf, speedIndexes, routeProgress, bestContext, recommendRoutes, hourBand } from '../../web/js/routeReco.js';
import { weatherAt } from '../../web/js/forecast.js';
import { sanitizeWorkout } from '../../web/js/workout.js';

// ---- synthetic tracks: a rounded path in metres around (32, 34.8); 1 fix per second at `mps`, optional GPS noise (deterministic) ----
const M = 1 / 111195; let seed = 3; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296) - 0.5;
const corners = { // an L-shaped 1.2 km route, a 2 km out-and-back, and a different parallel street
  L: [[0, 0], [600, 0], [600, 600]], out: [[0, 0], [1000, 0]], other: [[0, 400], [600, 400], [600, 1000]],
};
function walkPath(corners, { mps = 3, noise = 0, t0 = 0, dx = 0, reverse = false } = {}) {
  const pts = reverse ? [...corners].reverse() : corners, out = []; let t = t0;
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), n = Math.ceil(len / mps); for (let k = (i === 1 ? 0 : 1); k <= n; k++) { const f = k / n; out.push([32 + (ay + (by - ay) * f + dx + rnd() * noise) * M, 34.8 + (ax + (bx - ax) * f + rnd() * noise) * M / Math.cos(32 * Math.PI / 180), t]); t += 1000; } }
  return out;
}

test('simplify keeps the shape with few points; sampleAlong spaces points by distance; distToPath', () => {
  const track = walkPath(corners.L, { noise: 2 }), path = simplify(track);
  assert.ok(track.length > 300 && path.length <= 12, `${track.length} -> ${path.length}`); assert.ok(Math.abs(pathLength(path) - 1200) < 40, `${pathLength(path)}`);
  assert.equal(simplify(walkPath([[0, 0], [5000, 3000], [0, 6000], [4000, 1000]], { mps: 5 })).length <= 150, true);
  const s = sampleAlong(path, 25); assert.equal(s.length, 25); assert.deepEqual(s[0], path[0]);
  const C = Math.cos(32 * Math.PI / 180); assert.ok(distToPath([32 + 25 * M, 34.8 + 300 * M / C], path) < 30); assert.ok(distToPath([32 + 400 * M, 34.8 + 300 * M / C], path) > 250);
});
test('matchRoute: the same route (noisy, other speed) matches; other street, reverse, partial and different length do not', () => {
  const route = makeRoute(walkPath(corners.L), { id: 'rabc1', name: ' Park loop ' }); assert.equal(route.name, 'Park loop'); assert.ok(Math.abs(route.lengthM - 1200) < 30);
  assert.equal(matchRoute(walkPath(corners.L, { mps: 2.4, noise: 6 }), route).ok, true, 'same route, slower and noisy');
  assert.equal(matchRoute(walkPath(corners.L, { dx: 8, noise: 5 }), route).ok, true, 'a few metres off the line');
  assert.equal(matchRoute(walkPath(corners.other), route).ok, false, 'a parallel street 400 m away');
  assert.equal(matchRoute(walkPath(corners.L, { reverse: true }), route).ok, false, 'the other direction is another route');
  assert.equal(matchRoute(walkPath([[0, 0], [600, 0]]), route).ok, false, 'only the first half');
  assert.equal(matchRoute(walkPath(corners.out), route).ok, false); assert.equal(matchRoute([[32, 34.8, 0]], route).ok, false);
});
test('distanceAtTime follows a past attempt for the ghost; sanitizeRoute / sanitizeWorkout reject hostile data', () => {
  const t = walkPath(corners.out, { mps: 4 }); assert.ok(Math.abs(distanceAtTime(t, 100000) - 400) < 15); assert.ok(Math.abs(distanceAtTime(t, 1e9) - 1000) < 15); assert.equal(distanceAtTime([[1, 1, 0]], 5), 0);
  assert.equal(sanitizeRoute({ id: '__proto__', path: [[1, 1], [2, 2]] }), null); assert.equal(sanitizeRoute({ id: 'rabc1', path: [[1, 1]] }), null);
  const r = sanitizeRoute({ id: 'rabc1', name: '<b>x</b>\u0007', oneTime: 'yes', path: [[1, 1], [999, 2], [2, 2.123456789]], lengthM: -5 }); assert.deepEqual(r.path, [[1, 1], [2, 2.123457]]); assert.equal(r.oneTime, false); assert.equal(r.lengthM, 0);
  assert.equal(sanitizeWorkout({ startedAt: 5, routeId: '../x' }).routeId, undefined); assert.equal(sanitizeWorkout({ startedAt: 5, routeId: 'rabc1' }).routeId, 'rabc1');
});
test('weatherAt picks the forecast hour of a workout', () => {
  const h = (t, o = {}) => ({ t, temp: 21.6, feels: 22, rainP: 0, rain: 0, wind: 5, uv: 1, day: true, ...o }), base = Date.UTC(2026, 6, 15, 5);
  assert.deepEqual(weatherAt([h(base), h(base + 3600000, { rain: 1 })], base + 3600000 + 10), { tempC: 22, cond: 'rain' }); assert.equal(weatherAt([h(base)], base + 7200000), null); assert.equal(weatherAt([h(base, { wind: 40 })], base).cond, 'windy');
});

// ---- statistics and recommendations ----
const NOW = new Date(2026, 6, 15, 7, 0).getTime();
const at = (daysAgo, hour) => { const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d.getTime(); };
const att = (routeId, daysAgo, hour, paceSecPerKm, extra = {}) => ({ kind: 'run', routeId, startedAt: at(daysAgo, hour), distanceM: 5000, movingMs: paceSecPerKm * 5000, elapsedMs: paceSecPerKm * 5000, splits: [], ...extra });
const route = (id, km, oneTime = false) => ({ id, name: id, oneTime, createdAt: 0, lengthM: km * 1000, path: [[0, 0], [1, 1]] });

test('routeProgress: improving, steady, slower, new; best attempt; needs two attempts for a trend', () => {
  const r = route('rpark', 5), rows = [360, 355, 350, 340, 335, 330].map((p, i) => att('rpark', 30 - i * 4, 7, p));
  const pr = routeProgress(attemptsOf(r, rows)); assert.equal(pr.n, 6); assert.equal(pr.trend, 'improving'); assert.ok(pr.improvePct > 5 && pr.improvePct < 12, `${pr.improvePct}`); assert.equal(pr.best.movingMs / 5000, 330);
  assert.equal(routeProgress(attemptsOf(r, [att('rpark', 3, 7, 340)])).trend, 'new'); assert.equal(routeProgress([]).n, 0);
  assert.equal(routeProgress(attemptsOf(r, [340, 341, 339, 340].map((p, i) => att('rpark', 20 - i, 7, p)))).trend, 'steady'); assert.equal(routeProgress(attemptsOf(r, [330, 340, 360, 380].map((p, i) => att('rpark', 20 - i, 7, p)))).trend, 'slower');
});
test('bestContext: finds the hour band and weather where the person is fastest on a route', () => {
  const rows = [att('rp', 20, 6, 320), att('rp', 18, 7, 322), att('rp', 15, 18, 345), att('rp', 12, 19, 348), att('rp', 9, 6, 321, { weather: { tempC: 14, cond: 'clear' } }), att('rp', 6, 18, 346, { weather: { tempC: 31, cond: 'clear' } }), att('rp', 4, 7, 319, { weather: { tempC: 15, cond: 'clear' } }), att('rp', 2, 19, 347, { weather: { tempC: 30, cond: 'clear' } })];
  const c = bestContext(attemptsOf(route('rp', 5), rows)); assert.equal(c.band, 'morning'); assert.equal(c.weather, 'cool'); assert.equal(hourBand(at(0, 17)), 'evening');
});
test('recommendRoutes: prefers the route you do best on at this hour and in this weather; one-time routes and unused routes are ignored', () => {
  const a = route('ra', 5), b = route('rb', 5), trip = route('rtrip', 5, true), unused = route('rzz', 5);
  const rows = [
    ...[6, 7, 6, 7].map((h, i) => att('ra', 20 - i * 3, h, 320 + i)), ...[18, 19, 18, 19].map((h, i) => att('ra', 21 - i * 3, h, 350 + i)), // route A: much faster in the morning
    ...[6, 7, 18, 19, 6, 7, 18, 19].map((h, i) => att('rb', 40 - i * 3, h, 335 + (i % 2))), // route B: no difference, as often used as A
    ...[6, 7, 6, 7].map((h, i) => att('rtrip', 25 - i, h, 300)),
  ];
  const morning = recommendRoutes([a, b, trip, unused], rows, { now: NOW, hour: 7, weather: 'none', typicalM: 5000, kind: 'run' });
  assert.deepEqual(morning.map((x) => x.route.id).includes('rtrip'), false, 'one-time is ignored'); assert.equal(morning.some((x) => x.route.id === 'rzz'), false);
  assert.equal(morning[0].route.id, 'ra'); assert.ok(morning[0].reasons.includes('rr_band'));
  const evening = recommendRoutes([a, b], rows, { now: NOW, hour: 18, weather: 'none', typicalM: 5000, kind: 'run' }); assert.equal(evening[0].route.id, 'rb', 'in the evening route B is the better choice');
  assert.equal(recommendRoutes([a], [], { now: NOW, hour: 7 }).length, 0);
  const rested = recommendRoutes([a, b], [...rows, att('ra', 0, 6, 320)], { now: NOW, hour: 7, weather: 'none', typicalM: 5000, kind: 'run' }); assert.ok(rested.find((x) => x.route.id === 'ra').score < morning[0].score, 'just done today: lower');
});
