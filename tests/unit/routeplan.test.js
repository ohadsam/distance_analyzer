import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingPoint, dist, viaSets, scaleVia, isLoop, parseNominatim, parseOsrm, parseElevation, parseOverpass, overpassQuery, elevationUrl, elevationStats, wayKind, classifyRoute, countCrossings, scoreRoute, rankRoutes, similar } from '../../web/js/routePlan.js';
import { planRoutes, pool } from '../../web/js/planner.js';
import { lineLength, niceLength } from '../../web/js/ui/mapScreen.js';

const S = [32.08, 34.78];
// a straight line of n points, ~ `step` m apart, heading east
const line = (n, step = 50, from = S) => Array.from({ length: n }, (_, i) => bearingPoint(from, 90, i * step));

test('bearingPoint and dist agree', () => { for (const b of [0, 90, 200, 300]) assert.ok(Math.abs(dist(S, bearingPoint(S, b, 1000)) - 1000) < 3); });
test('isLoop: same place or no end', () => { assert.ok(isLoop(S, null)); assert.ok(isLoop(S, bearingPoint(S, 0, 100))); assert.ok(!isLoop(S, bearingPoint(S, 0, 800))); });
test('viaSets: loop gives rings around the start, sized for the distance', () => {
  const v = viaSets(S, S, 5000); assert.ok(v.length >= 6); assert.ok(new Set(v.map((x) => x.id)).size === v.length);
  const ring = v.find((x) => x.id === 'loop0'); assert.equal(ring.via.length, 2); for (const p of ring.via) assert.ok(dist(S, p) < 1500 && dist(S, p) > 300);
});
test('viaSets: A to B direct when the target is short, detours (both sides) when long', () => {
  const B = bearingPoint(S, 90, 2000);
  assert.deepEqual(viaSets(S, B, 2100).map((x) => x.id), ['direct']);
  const long = viaSets(S, B, 6000); assert.ok(long.length >= 5 && long.some((x) => x.id.startsWith('detourL')) && long.some((x) => x.id.startsWith('detourR')));
  for (const c of long.filter((x) => x.via.length)) { const d = dist(S, c.via[0]) + dist(c.via[0], B); assert.ok(d > 2500 && d < 8000, `detour ${d}`); }
});
test('viaSets clamps absurd distances', () => { assert.ok(viaSets(S, S, 5).length > 0); assert.ok(viaSets(S, S, 1e9).every((x) => x.via.every((p) => dist(S, p) < 20000))); });
test('scaleVia moves via-points away from the anchor', () => { const v = viaSets(S, S, 5000)[0].via, w = scaleVia(S, S, v, 1.5); assert.ok(Math.abs(dist(S, w[0]) / dist(S, v[0]) - 1.5) < 0.02); });

test('parseNominatim keeps valid places only and trims', () => {
  const r = parseNominatim([{ display_name: ' Herzl 1, Tel Aviv ', lat: '32.06', lon: '34.77' }, { display_name: 'bad', lat: 'x', lon: '1' }, { display_name: '', lat: 1, lon: 1 }, null]);
  assert.deepEqual(r, [{ name: 'Herzl 1, Tel Aviv', lat: 32.06, lon: 34.77 }]); assert.deepEqual(parseNominatim({}), []); assert.equal(parseNominatim(new Array(20).fill({ display_name: 'a', lat: 1, lon: 1 })).length, 5);
});
test('parseOsrm swaps lon/lat, rejects junk', () => {
  const r = parseOsrm({ code: 'Ok', routes: [{ distance: 1234, geometry: { coordinates: [[34.78, 32.08], [34.79, 32.081], [999, 0]] } }] });
  assert.deepEqual(r.path, [[32.08, 34.78], [32.081, 34.79]]); assert.equal(r.distanceM, 1234);
  assert.equal(parseOsrm({ code: 'NoRoute' }), null); assert.equal(parseOsrm({ code: 'Ok', routes: [{ geometry: { coordinates: [[1, 1]] } }] }), null); assert.equal(parseOsrm(null), null);
});
test('parseElevation requires the right count of numbers', () => { assert.deepEqual(parseElevation({ elevation: [1.04, 2] }, 2), [1, 2]); assert.equal(parseElevation({ elevation: [1] }, 2), null); assert.equal(parseElevation({ elevation: [1, 'x'] }, 2), null); });
test('urls: elevation and overpass are bounded and well formed', () => {
  const { pts, url } = elevationUrl(line(300)); assert.ok(pts.length <= 60 && url.startsWith('https://api.open-meteo.com/v1/elevation?latitude=') && url.includes('&longitude='));
  const q = overpassQuery(line(300)); assert.ok(q.startsWith('[out:json]') && q.includes('around:18') && q.length < 2500);
});
test('parseOverpass trims tags and sorts ways and crossings', () => {
  const r = parseOverpass({ elements: [{ type: 'way', tags: { highway: 'footway', footway: 'sidewalk', name: 'x', surface: 'asphalt' }, geometry: [{ lat: 1, lon: 1 }, { lat: 1.0001, lon: 1 }] }, { type: 'node', lat: 1, lon: 1, tags: { highway: 'crossing', crossing: 'traffic_signals' } }, { type: 'way', tags: { highway: 'path' }, geometry: [{ lat: 1, lon: 1 }] }, { type: 'bogus' }] });
  assert.equal(r.ways.length, 1); assert.equal(r.ways[0].tags.name, undefined); assert.equal(r.crossings.length, 1); assert.ok(r.crossings[0].signals);
});

test('elevationStats ignores noise, counts real climbs, finds the steepest stretch', () => {
  const path = line(10, 100), flat = elevationStats([10, 11, 10, 11, 10, 11, 10, 11, 10, 11], path); assert.equal(flat.ascentM, 0);
  const hill = elevationStats([10, 10, 20, 30, 30, 20, 10, 10, 10, 10], path); assert.equal(hill.ascentM, 20); assert.equal(hill.descentM, 20); assert.ok(hill.steepestPct >= 8 && hill.steepestPct <= 12, String(hill.steepestPct));
  assert.equal(elevationStats(null, path), null);
});
test('wayKind', () => {
  assert.equal(wayKind({ highway: 'footway', footway: 'sidewalk' }), 'sidewalk'); assert.equal(wayKind({ highway: 'path' }), 'trail'); assert.equal(wayKind({ highway: 'track' }), 'trail');
  assert.equal(wayKind({ highway: 'pedestrian' }), 'path'); assert.equal(wayKind({ highway: 'residential', sidewalk: 'both' }), 'sidewalk'); assert.equal(wayKind({ highway: 'residential', sidewalk: 'no' }), 'road'); assert.equal(wayKind({ highway: 'secondary' }), 'road');
});
test('classifyRoute shares the route between the ways it runs along', () => {
  const p = line(41, 50), ways = [{ tags: { highway: 'footway', footway: 'sidewalk' }, geom: p.slice(0, 21) }, { tags: { highway: 'path', surface: 'dirt' }, geom: p.slice(20) }];
  const c = classifyRoute(p, ways); assert.ok(Math.abs(c.sidewalkPct - 50) <= 4 && Math.abs(c.trailPct - 50) <= 4 && c.unpavedPct >= 40 && c.roadPct === 0, JSON.stringify(c));
  assert.equal(classifyRoute(p, []), null); assert.equal(classifyRoute(p, [{ tags: { highway: 'path' }, geom: line(3, 50, bearingPoint(S, 0, 5000)) }]).unknownPct, 100);
});
test('countCrossings: only near the path, a wide crossing counts once', () => {
  const p = line(41, 50), on = bearingPoint(p[10], 0, 6), far = bearingPoint(p[10], 0, 200);
  const r = countCrossings(p, [{ lat: on[0], lon: on[1], signals: true }, { lat: on[0], lon: on[1] + 0.00005, signals: false }, { lat: far[0], lon: far[1] }]); assert.deepEqual(r, { crossings: 1, signalled: 1 });
});

const mk = (extra) => ({ path: line(30, 100), distanceM: 3000, ascentM: 10, descentM: 10, crossings: 2, signalled: 1, surface: { sidewalkPct: 70, pathPct: 20, trailPct: 0, roadPct: 10, unknownPct: 0, unpavedPct: 0 }, ...extra });
test('scoreRoute: distance dominates and the closer route scores higher', () => {
  const req = { targetM: 3000 }; assert.ok(scoreRoute(mk(), req).score > scoreRoute(mk({ distanceM: 3600 }), req).score); assert.ok(scoreRoute(mk({ distanceM: 6000 }), req).score < 60);
  assert.equal(scoreRoute(mk(), req).why[0][0], 'planWhyDist');
});
test('scoreRoute: preferences change the order', () => {
  const hilly = mk({ ascentM: 150, crossings: 0 }), flat = mk({ ascentM: 5, crossings: 9 });
  assert.ok(scoreRoute(flat, { targetM: 3000, prefs: { hills: 'flat' } }).score > scoreRoute(hilly, { targetM: 3000, prefs: { hills: 'flat' } }).score);
  assert.ok(scoreRoute(hilly, { targetM: 3000, prefs: { crossings: 'few' } }).score > scoreRoute(flat, { targetM: 3000, prefs: { crossings: 'few' } }).score);
  const trail = mk({ surface: { sidewalkPct: 0, pathPct: 0, trailPct: 90, roadPct: 10, unknownPct: 0, unpavedPct: 80 } });
  assert.ok(scoreRoute(trail, { targetM: 3000, prefs: { surface: 'trail' } }).score > scoreRoute(mk(), { targetM: 3000, prefs: { surface: 'trail' } }).score);
});
test('scoreRoute: missing data is neutral and never crashes', () => { const r = scoreRoute(mk({ ascentM: null, descentM: null, crossings: null, surface: null }), { targetM: 3000 }); assert.ok(r.score > 40 && r.score < 100); assert.equal(r.why.length, 1); });
test('similar / rankRoutes drop near-duplicates and sort best first', () => {
  const a = mk(), b = mk({ distanceM: 3010 }), c = mk({ path: line(30, 100, bearingPoint(S, 0, 2000)), distanceM: 3400 });
  assert.ok(similar(a, b)); assert.ok(!similar(a, c));
  const r = rankRoutes([c, a, b], { targetM: 3000 }); assert.equal(r.length, 2); assert.ok(r[0].score >= r[1].score); assert.equal(rankRoutes([], { targetM: 3000 }).length, 0);
});

test('pool limits concurrency and turns failures into null', async () => {
  let live = 0, max = 0; const out = await pool([1, 2, 3, 4, 5, 6], 2, async (n) => { live++; max = Math.max(max, live); await new Promise((r) => setTimeout(r, 5)); live--; if (n === 3) throw new Error('x'); return n; });
  assert.deepEqual(out, [1, 2, null, 4, 5, 6]); assert.ok(max <= 2);
});
// a fake world: the route length follows how far the via-points are from the start (so the correction pass can converge)
const fakeApi = (over = {}) => ({
  async route(points) { let len = 0; for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]); len *= 1.7; return { path: points.length > 1 ? [...points, points[0]] : points, distanceM: len }; },
  async elevation(path) { return { elev: path.map((_, i) => 20 + (i % 5) * 4).slice(0, 60) }; },
  async tags() { return { ways: [{ tags: { highway: 'footway', footway: 'sidewalk' }, geom: [S, bearingPoint(S, 0, 20000)] }], crossings: [] }; }, ...over,
});
test('planRoutes: finds, corrects towards the distance, enriches and ranks', async () => {
  const seen = []; const r = await planRoutes({ start: S, end: null, targetM: 5000, prefs: {} }, fakeApi(), (p) => seen.push(p));
  assert.ok(r.routes.length >= 1 && r.routes.length <= 5); assert.ok(seen.includes('routes') && seen.includes('details'));
  assert.ok(r.routes[0].score >= r.routes[r.routes.length - 1].score); assert.ok(r.notes.elevation && r.notes.streets);
  assert.ok(Math.abs(r.routes[0].distanceM - 5000) / 5000 < 0.25, `best ${r.routes[0].distanceM}`); assert.ok(r.routes[0].why.length >= 2);
});
test('planRoutes: still works without elevation and street data, and says so', async () => {
  const r = await planRoutes({ start: S, end: bearingPoint(S, 90, 3000), targetM: 3000, prefs: {} }, fakeApi({ elevation: async () => { throw new Error('x'); }, tags: async () => null }));
  assert.ok(r.routes.length >= 1); assert.equal(r.notes.elevation, false); assert.equal(r.notes.streets, false); assert.equal(r.routes[0].ascentM, null);
});
test('planRoutes: nothing routable -> no routes, no crash', async () => { const r = await planRoutes({ start: S, end: null, targetM: 5000 }, fakeApi({ route: async () => null })); assert.deepEqual(r.routes, []); });

test('map helpers: lineLength and niceLength', () => {
  assert.equal(lineLength([]), 0); assert.ok(Math.abs(lineLength([S, bearingPoint(S, 0, 500), bearingPoint(bearingPoint(S, 0, 500), 90, 300)]) - 800) < 3);
  assert.equal(niceLength(130), 100); assert.equal(niceLength(270), 200); assert.equal(niceLength(700), 500); assert.equal(niceLength(0.5), 1);
});
