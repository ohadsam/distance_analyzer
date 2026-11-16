// Route planner maths (pure, no network, no DOM): candidate via-points for a requested distance, parsers for the three online services (untrusted
// JSON -> safe numbers), elevation / crossing / surface analysis of a path, and the scoring that ranks routes by how well they match the request.
// A route here is { path: [[lat, lon]], distanceM, ascentM, descentM, crossings, ... }; the network lives in planApi.js, the orchestration in planner.js.
import { haversine } from './geo.js';
import { distToPath, pathLength, sampleAlong } from './route.js';
import { clamp } from './util.js';

const R = 6371008.8, rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
export const CIRCUITY = 1.3; // roads are about 30% longer than the straight line - the first guess, corrected after the first answer
export const SAME_PLACE_M = 150; // an end this close to the start is "the same place": a loop
export const MIN_TARGET_M = 1000, MAX_TARGET_M = 42000;
const P = (a) => ({ lat: a[0], lon: a[1] });
export const dist = (a, b) => haversine(P(a), P(b));

/** The point `m` metres from `a` along `bearing` degrees (0 = north, clockwise). */
export function bearingPoint(a, bearing, m) {
  const d = m / R, b = rad(bearing), la = rad(a[0]), lo = rad(a[1]);
  const lat = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lon = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat));
  return [Math.round(deg(lat) * 1e6) / 1e6, Math.round((((deg(lon) + 540) % 360) - 180) * 1e6) / 1e6];
}
export function bearingOf(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0])), x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
export const isLoop = (start, end) => !end || dist(start, end) <= SAME_PLACE_M;

/**
 * Different ways to cover about `targetM`: each candidate is { id, via: [[lat, lon]] } to put between start and end.
 * Loop: a ring through two points, started in six directions. Out and back: one far point (the road back may differ). Start -> end farther
 * than asked: the direct way only. Start -> end shorter than asked: a detour to the left and right, at three places along the way.
 */
export function viaSets(start, end, targetM, { circuity = CIRCUITY } = {}) {
  const target = clamp(targetM, MIN_TARGET_M, MAX_TARGET_M), out = [];
  if (isLoop(start, end)) {
    const r = target / (2 * Math.PI * circuity); // a ring of that circumference, on the road
    for (let k = 0; k < 6; k++) {
      const th = k * 60, c = bearingPoint(start, th, r);
      out.push({ id: `loop${th}`, via: [bearingPoint(c, th + 180 + 120, r), bearingPoint(c, th + 180 + 240, r)] });
    }
    out.push({ id: 'back', via: [bearingPoint(start, 0, target / (2 * circuity))] });
    return out;
  }
  const d = dist(start, end), mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], br = bearingOf(start, end);
  out.push({ id: 'direct', via: [] });
  if (target > d * circuity * 1.12) {
    const half = target / (2 * circuity), h = Math.sqrt(Math.max(0, half * half - (d / 2) ** 2));
    for (const side of [90, -90]) for (const f of [0.35, 0.5, 0.65]) {
      const base = [start[0] + (end[0] - start[0]) * f, start[1] + (end[1] - start[1]) * f];
      out.push({ id: `detour${side > 0 ? 'R' : 'L'}${Math.round(f * 100)}`, via: [bearingPoint(base, br + side, h * (f === 0.5 ? 1 : 1.15))] });
    }
  }
  return out;
}
/** Stretch (or shrink) a candidate's via-points away from the start (loop) or from the middle line (A to B) by `f`, to correct the first guess. */
export function scaleVia(start, end, via, f) {
  const anchor = isLoop(start, end) ? start : [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  return via.map((v) => bearingPoint(anchor, bearingOf(anchor, v), dist(anchor, v) * f));
}

// ---------- service parsers (untrusted JSON) ----------
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const okPoint = (la, lo) => num(la) != null && num(lo) != null && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
const str = (v, max = 160) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');

/** Nominatim search -> [{ name, lat, lon }] (at most 5). */
export function parseNominatim(json) {
  if (!Array.isArray(json)) return [];
  return json.slice(0, 5).map((r) => ({ name: str(r?.display_name), lat: Number(r?.lat), lon: Number(r?.lon) })).filter((r) => r.name && okPoint(r.lat, r.lon));
}
/** OSRM route answer -> { path, distanceM } or null. GeoJSON order is [lon, lat]. */
export function parseOsrm(json) {
  const rt = json?.routes?.[0]; if (json?.code !== 'Ok' || !rt || !Array.isArray(rt.geometry?.coordinates)) return null;
  const path = rt.geometry.coordinates.slice(0, 20000).filter((c) => Array.isArray(c) && okPoint(c[1], c[0])).map((c) => [Math.round(c[1] * 1e6) / 1e6, Math.round(c[0] * 1e6) / 1e6]);
  if (path.length < 2) return null;
  return { path, distanceM: num(rt.distance) != null && rt.distance > 0 ? rt.distance : pathLength(path) };
}
/** Open-Meteo elevation answer -> metres per requested point, or null when it does not match. */
export function parseElevation(json, n) {
  const e = json?.elevation; if (!Array.isArray(e) || e.length !== n || e.some((v) => num(v) == null)) return null;
  return e.map((v) => Math.round(v * 10) / 10);
}
export const ELEV_POINTS = 60;
export function elevationUrl(path, n = ELEV_POINTS) {
  const pts = sampleAlong(path, Math.min(n, 100));
  return { pts, url: `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p[0].toFixed(5)).join(',')}&longitude=${pts.map((p) => p[1].toFixed(5)).join(',')}` };
}
/** The Overpass question: every walkable way within 18 m of the route, with its shape, and every crossing node near it. */
export function overpassQuery(path) {
  const pts = sampleAlong(path, 36), line = pts.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(',');
  return `[out:json][timeout:25];(way(around:18,${line})["highway"];node(around:15,${line})["highway"="crossing"];node(around:15,${line})["crossing"];);out tags geom 1500;`;
}
/** Overpass answer -> { ways: [{ tags, geom }], crossings: [{ lat, lon, signals }] } (tags trimmed to the few that matter). */
const KEEP = ['highway', 'footway', 'surface', 'sidewalk', 'sidewalk:left', 'sidewalk:right', 'sidewalk:both', 'crossing', 'foot', 'tracktype', 'smoothness'];
export function parseOverpass(json) {
  const ways = [], crossings = [];
  for (const el of Array.isArray(json?.elements) ? json.elements.slice(0, 4000) : []) {
    const tags = {}; for (const k of KEEP) if (typeof el?.tags?.[k] === 'string') tags[k] = el.tags[k].slice(0, 40);
    if (el?.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 2) {
      const geom = el.geometry.slice(0, 400).filter((g) => okPoint(g?.lat, g?.lon)).map((g) => [g.lat, g.lon]); if (geom.length >= 2 && tags.highway) ways.push({ tags, geom });
    } else if (el?.type === 'node' && okPoint(el.lat, el.lon) && tags.crossing !== 'no') crossings.push({ lat: el.lat, lon: el.lon, signals: /signal|traffic_signals/.test(tags.crossing || '') });
  }
  return { ways, crossings };
}

// ---------- analysis of one route ----------
/** Climb and descent from elevation samples; wiggles under `thresholdM` (data noise) do not count. Also the steepest stretch (%) over >= 40 m. */
export function elevationStats(elev, path, thresholdM = 3) {
  if (!elev || elev.length < 2) return null;
  let ascent = 0, descent = 0, ref = elev[0];
  for (const e of elev) { if (e - ref >= thresholdM) { ascent += e - ref; ref = e; } else if (ref - e >= thresholdM) { descent += ref - e; ref = e; } }
  const pts = sampleAlong(path, elev.length); let steepest = 0;
  for (let i = 0; i < elev.length; i++) for (let j = i + 1; j < elev.length; j++) {
    const d = dist(pts[i], pts[j]); if (d >= 40) { steepest = Math.max(steepest, Math.abs(elev[j] - elev[i]) / d * 100); break; }
  }
  return { ascentM: Math.round(ascent), descentM: Math.round(descent), minM: Math.round(Math.min(...elev)), maxM: Math.round(Math.max(...elev)), steepestPct: Math.round(steepest * 10) / 10 };
}
const UNPAVED = new Set(['unpaved', 'dirt', 'gravel', 'ground', 'grass', 'sand', 'mud', 'compacted', 'fine_gravel', 'earth', 'pebblestone', 'woodchips', 'grass_paver']);
const hasSidewalk = (t) => ['sidewalk', 'sidewalk:left', 'sidewalk:right', 'sidewalk:both'].some((k) => t[k] && t[k] !== 'no' && t[k] !== 'none');
/** What kind of way is this? sidewalk | path (footway, pedestrian, cycleway, steps) | trail (path/track/bridleway) | road (no sidewalk mapped) */
export function wayKind(tags) {
  const hw = tags.highway || '';
  if (hw === 'footway' && tags.footway === 'sidewalk') return 'sidewalk';
  if (hw === 'footway' && tags.footway === 'crossing') return 'sidewalk';
  if (hw === 'path' || hw === 'track' || hw === 'bridleway') return 'trail';
  if (hw === 'footway' || hw === 'pedestrian' || hw === 'cycleway' || hw === 'steps' || hw === 'living_street') return 'path';
  return hasSidewalk(tags) ? 'sidewalk' : 'road';
}
/** Share of the route (0-100) on each kind of way, from the ways Overpass found; samples with no way near are "unknown". */
export function classifyRoute(path, ways, { samples = 80, within = 20 } = {}) {
  if (!ways?.length) return null;
  const pts = sampleAlong(path, samples), cnt = { sidewalk: 0, path: 0, trail: 0, road: 0, unknown: 0, unpaved: 0 };
  for (const p of pts) {
    let best = null, bd = within;
    for (const w of ways) { const d = distToPath(p, w.geom); if (d < bd) { bd = d; best = w; } }
    if (!best) { cnt.unknown++; continue; }
    cnt[wayKind(best.tags)]++; if (UNPAVED.has(best.tags.surface)) cnt.unpaved++;
  }
  const pc = (n) => Math.round(n / pts.length * 100);
  return { sidewalkPct: pc(cnt.sidewalk), pathPct: pc(cnt.path), trailPct: pc(cnt.trail), roadPct: pc(cnt.road), unknownPct: pc(cnt.unknown), unpavedPct: pc(cnt.unpaved) };
}
/** Road crossings the route passes (nodes within 15 m, one per 25 m so a wide crossing is one), and how many have traffic lights. */
export function countCrossings(path, nodes) {
  const near = (nodes || []).filter((n) => distToPath([n.lat, n.lon], path) <= 15), kept = [];
  for (const n of near) if (!kept.some((k) => dist([k.lat, k.lon], [n.lat, n.lon]) < 25)) kept.push(n);
  return { crossings: kept.length, signalled: kept.filter((k) => k.signals).length };
}

// ---------- scoring ----------
export const DEFAULT_PREFS = { hills: 'any', crossings: 'any', surface: 'any' }; // hills: flat | any | hilly; crossings: few | any; surface: sidewalk | trail | any
/**
 * 0-100: how well a route fits the request. Distance dominates (it is what was asked); hills, crossings and surface count more when the person
 * said they care. Data we could not get counts as neutral, never as good. `why` lists the facts for the card as [i18n key, params].
 */
export function scoreRoute(c, req) {
  const prefs = { ...DEFAULT_PREFS, ...(req.prefs || {}) }, km = Math.max(0.1, c.distanceM / 1000), why = [];
  const err = Math.abs(c.distanceM - req.targetM) / req.targetM, dScore = clamp(1 - err / 0.3, 0, 1);
  why.push(['planWhyDist', { pct: Math.round(err * 100), dir: c.distanceM >= req.targetM ? 1 : 0 }]);
  const perKm = c.ascentM == null ? null : c.ascentM / km;
  let hScore = perKm == null ? 0.5 : clamp(1 - perKm / 40, 0, 1); // 40 m of climb per km is a steep route
  if (prefs.hills === 'hilly' && perKm != null) hScore = clamp(perKm / 25, 0, 1);
  if (perKm != null) why.push([perKm < 8 ? 'planWhyFlat' : perKm < 20 ? 'planWhyRolling' : 'planWhyHilly', { up: c.ascentM, down: c.descentM }]);
  const cPerKm = c.crossings == null ? null : c.crossings / km;
  const cScore = cPerKm == null ? 0.5 : clamp(1 - cPerKm / 6, 0, 1);
  if (cPerKm != null) why.push([c.crossings === 0 ? 'planWhyNoCross' : 'planWhyCross', { n: c.crossings, lights: c.signalled || 0 }]);
  let sScore = 0.5;
  if (c.surface) {
    const good = c.surface.sidewalkPct + c.surface.pathPct + c.surface.trailPct, safe = c.surface.sidewalkPct + c.surface.pathPct;
    sScore = prefs.surface === 'trail' ? (c.surface.trailPct + c.surface.pathPct * 0.5) / 100 : prefs.surface === 'sidewalk' ? safe / 100 : good / 100;
    if (c.surface.roadPct >= 25) why.push(['planWhyRoad', { pct: c.surface.roadPct }]); else if (c.surface.trailPct >= 25) why.push(['planWhyTrail', { pct: c.surface.trailPct }]); else why.push(['planWhySidewalk', { pct: safe }]);
  }
  const w = { d: 0.5, h: prefs.hills === 'any' ? 0.1 : 0.22, c: prefs.crossings === 'any' ? 0.1 : 0.22, s: prefs.surface === 'any' ? 0.12 : 0.22 }, sum = w.d + w.h + w.c + w.s;
  const score = Math.round(100 * (w.d * dScore + w.h * hScore + w.c * cScore + w.s * clamp(sScore, 0, 1)) / sum);
  return { score, why, parts: { dist: dScore, hills: hScore, cross: cScore, surface: clamp(sScore, 0, 1) } };
}
/** Two routes that run along the same streets: the lower-ranked one is dropped. */
export function similar(a, b) {
  if (Math.abs(a.distanceM - b.distanceM) > 0.08 * Math.max(a.distanceM, b.distanceM)) return false;
  const sa = sampleAlong(a.path, 24); let sum = 0; for (const p of sa) sum += distToPath(p, b.path);
  return sum / sa.length < 45;
}
/** Score, drop near-duplicates, best first. Each gets { score, why, parts }. */
export function rankRoutes(cands, req, max = 5) {
  const scored = cands.map((c) => ({ ...c, ...scoreRoute(c, req) })).sort((a, b) => b.score - a.score), out = [];
  for (const c of scored) if (!out.some((o) => similar(o, c))) out.push(c);
  return out.slice(0, max);
}
