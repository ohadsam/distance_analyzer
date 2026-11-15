// Pure route geometry: simplify a recorded track into a reusable route, decide whether a workout followed a saved route, and compare against
// a past attempt ("ghost"). No DOM, no storage. Tracks are [[lat, lon, t], ...] (workout points); a route's path is [[lat, lon], ...].
import { haversine } from './geo.js';
import { clamp, cleanText } from './util.js';

export const MAX_ROUTE_POINTS = 150, MAX_ROUTES = 100, MIN_ROUTE_M = 300;
const rad = (d) => (d * Math.PI) / 180;

/** Local metres (x east, y north) around a reference latitude - exact enough for a few kilometres. */
const toXY = (p, lat0) => [rad(p[1]) * 6371008.8 * Math.cos(rad(lat0)), rad(p[0]) * 6371008.8];

/** Ramer-Douglas-Peucker with a tolerance in metres, then relaxed until at most `max` points remain. */
export function simplify(track, max = MAX_ROUTE_POINTS) {
  const pts = track.map((p) => [p[0], p[1]]); if (pts.length <= 2) return pts;
  const lat0 = pts[0][0], xy = pts.map((p) => toXY(p, lat0));
  const run = (eps) => {
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let far = -1, dmax = eps;
      const [ax, ay] = xy[a], [bx, by] = xy[b], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1e-9;
      for (let i = a + 1; i < b; i++) { const t = clamp(((xy[i][0] - ax) * dx + (xy[i][1] - ay) * dy) / len2, 0, 1), d = Math.hypot(xy[i][0] - (ax + t * dx), xy[i][1] - (ay + t * dy)); if (d > dmax) { dmax = d; far = i; } }
      if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  };
  for (let eps = 6; ; eps *= 1.6) { const out = run(eps); if (out.length <= max || eps > 5000) return out.slice(0, max); }
}

export function pathLength(path) { let m = 0; for (let i = 1; i < path.length; i++) m += haversine({ lat: path[i - 1][0], lon: path[i - 1][1] }, { lat: path[i][0], lon: path[i][1] }); return m; }

/** `n` points evenly spaced along the path by distance (always includes both ends). */
export function sampleAlong(path, n = 40) {
  if (path.length < 2) return path.map((p) => [p[0], p[1]]);
  const total = pathLength(path) || 1, out = [[path[0][0], path[0][1]]]; let acc = 0, next = total / (n - 1), i = 1;
  while (out.length < n - 1 && i < path.length) {
    const a = path[i - 1], b = path[i], seg = haversine({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] });
    if (acc + seg >= next && seg > 0) { const f = (next - acc) / seg; out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); next += total / (n - 1); } else { acc += seg; i++; }
  }
  out.push([path[path.length - 1][0], path[path.length - 1][1]]); return out;
}

/** Distance in metres from a point to a polyline. */
export function distToPath(p, path) {
  if (path.length === 1) return haversine({ lat: p[0], lon: p[1] }, { lat: path[0][0], lon: path[0][1] });
  const lat0 = p[0], xy = path.map((x) => toXY(x, lat0)), c = toXY(p, lat0); let best = Infinity;
  for (let i = 1; i < xy.length; i++) { const [ax, ay] = xy[i - 1], [bx, by] = xy[i], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1e-9, t = clamp(((c[0] - ax) * dx + (c[1] - ay) * dy) / len2, 0, 1); best = Math.min(best, Math.hypot(c[0] - (ax + t * dx), c[1] - (ay + t * dy))); }
  return best;
}

/** Route record from a workout's track. */
export function makeRoute(track, { id, name, oneTime = false, now = Date.now() }) {
  const path = simplify(track); return { id, name: cleanText(name, 40) || 'Route', oneTime: oneTime === true, createdAt: now, lengthM: Math.round(pathLength(path)), path };
}

/**
 * Did this track follow that route? Same direction, similar length, near the start and end, and the sampled points stay on the line in BOTH
 * directions (a track that merely crosses the route, or covers only part of it, does not match). Returns { ok, avg, max } (metres).
 */
export function matchRoute(track, route) {
  if (track.length < 5 || route.path.length < 2) return { ok: false };
  const path = simplify(track), len = pathLength(path), L = route.lengthM || pathLength(route.path);
  if (len < MIN_ROUTE_M || Math.abs(len - L) / L > 0.2) return { ok: false };
  const s = haversine({ lat: path[0][0], lon: path[0][1] }, { lat: route.path[0][0], lon: route.path[0][1] });
  const e = haversine({ lat: path[path.length - 1][0], lon: path[path.length - 1][1] }, { lat: route.path[route.path.length - 1][0], lon: route.path[route.path.length - 1][1] });
  if (s > 150 || e > 250) return { ok: false };
  const d1 = sampleAlong(path, 40).map((p) => distToPath(p, route.path)), d2 = sampleAlong(route.path, 40).map((p) => distToPath(p, path));
  const all = [...d1, ...d2], avg = all.reduce((a, b) => a + b, 0) / all.length, max = Math.max(...all);
  return { ok: avg <= 35 && max <= 120, avg: Math.round(avg), max: Math.round(max) };
}

/** Distance (metres) covered by a recorded track after `ms` of moving time since its first point (for the "ghost" of a past attempt). */
export function distanceAtTime(track, ms) {
  if (track.length < 2) return 0; const t0 = track[0][2]; let d = 0;
  for (let i = 1; i < track.length; i++) {
    const seg = haversine({ lat: track[i - 1][0], lon: track[i - 1][1] }, { lat: track[i][0], lon: track[i][1] }), dt = track[i][2] - track[i - 1][2];
    if (track[i][2] - t0 >= ms) return d + (dt > 0 ? seg * clamp((ms - (track[i - 1][2] - t0)) / dt, 0, 1) : 0);
    d += seg;
  }
  return d;
}

/** Untrusted route record -> a safe one, or null. */
export function sanitizeRoute(r) {
  if (!r || typeof r !== 'object' || !/^r[a-z0-9]{3,24}$/.test(String(r.id))) return null;
  const path = Array.isArray(r.path) ? r.path.slice(0, MAX_ROUTE_POINTS).filter((p) => Array.isArray(p) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180 && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6]) : [];
  if (path.length < 2) return null;
  return { id: r.id, name: cleanText(r.name, 40) || 'Route', oneTime: r.oneTime === true, createdAt: clamp(Number(r.createdAt) || 0, 0, 4e12), lengthM: clamp(Number(r.lengthM) || Math.round(pathLength(path)), 0, 1e7), path };
}
