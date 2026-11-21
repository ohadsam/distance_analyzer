// Pure workout model: GPS fixes in, distance / moving time / pace / km splits out. Plain serialisable objects; time is always passed in.
import { haversine, validPoint } from './geo.js';
import { clamp } from './util.js';

export const LIMITS = { maxAccuracyM: 35, maxSpeedMps: 12, movingMps: 0.5, paceWindowMs: 30000, maxPoints: 20000, kinds: ['walk', 'run'] };

/** How the real start of an activity is recognised (from the GPS fixes alone): a steady stretch of at least `minDistM` metres at no less than `minSpeedMps`, in a window of 4-20 s. A run needs a quicker, longer stretch than a walk. */
export const START = { walk: { minDistM: 12, minSpeedMps: 0.9 }, run: { minDistM: 18, minSpeedMps: 1.8 }, minWindowMs: 4000, maxWindowMs: 20000, maxAccM: 25, straight: 0.6 };

/**
 * waitForMotion = the person pressed Start, but measuring only begins when they really start moving (`waiting` until then; time, distance and the route stay empty).
 * Without it the workout is measuring from `now` (the older behaviour, and what a restored workout does).
 */
export function newWorkout(kind, now, { waitForMotion = false } = {}) {
  return { kind: LIMITS.kinds.includes(kind) ? kind : 'walk', startedAt: now, waiting: !!waitForMotion, endedAt: 0, pausedMs: 0, pausedAt: 0, distanceM: 0, movingMs: 0, splits: [], points: [], last: null, recent: [], warm: [], marks: [] };
}
/** True while the workout waits for the real start of the activity. */
export const isWaiting = (w) => w.waiting === true;

/**
 * Index in `fixes` (oldest first, objects { lat, lon, t, acc }) where steady movement began, or -1. Pure: a standing person's GPS jitter (wandering, not travelling) never qualifies.
 * The EARLIEST qualifying start is returned, so the first steps of the run are not lost.
 */
export function detectStart(fixes, kind) {
  const need = START[kind === 'run' ? 'run' : 'walk'], f = fixes.filter((x) => validPoint(x) && Number.isFinite(x.t) && !(Number.isFinite(x.acc) && x.acc > START.maxAccM));
  if (f.length < 2) return -1;
  const last = f[f.length - 1];
  for (let i = 0; i < f.length - 1; i++) {
    const dt = last.t - f[i].t; if (dt < START.minWindowMs || dt > START.maxWindowMs) continue;
    const d = haversine(f[i], last); if (d < need.minDistM || d / (dt / 1000) < need.minSpeedMps) continue;
    let path = 0; for (let j = i; j < f.length - 1; j++) path += haversine(f[j], f[j + 1]);
    if (d >= START.straight * path) return fixes.indexOf(f[i]); // travelled, not wandered
  }
  return -1;
}
/** Measuring begins now (the person said so, or there is no GPS to tell): everything before this moment is not part of the workout. */
export function startNow(w, now) { if (w.waiting) { w.waiting = false; w.startedAt = now; w.pausedMs = 0; w.warm = []; } return w; }

export const isPaused = (w) => w.pausedAt > 0;
export const isFinished = (w) => w.endedAt > 0;

export function pause(w, now) { if (!isPaused(w) && !isFinished(w)) w.pausedAt = now; return w; }
export function resume(w, now) { if (isPaused(w)) { w.pausedMs += now - w.pausedAt; w.pausedAt = 0; w.last = null; w.recent = []; } return w; } // no distance and no pace window across the gap
export function finish(w, now) { if (isPaused(w)) { w.pausedMs += now - w.pausedAt; w.pausedAt = 0; } if (!isFinished(w)) w.endedAt = now; return w; }

/** Wall-clock time of the workout without paused time. */
export function elapsedMs(w, now) {
  if (isWaiting(w)) return 0;
  const end = w.endedAt || (w.pausedAt || now);
  return Math.max(0, end - w.startedAt - w.pausedMs);
}

/** While waiting for the start: keeps the last ~25 s of fixes and, when they show steady movement, begins measuring from where it began (back-dated) and replays those fixes. */
function waitFix(w, fix) {
  const warm = w.warm || (w.warm = []); if (warm.length && fix.t <= warm[warm.length - 1].t) return false;
  warm.push({ lat: fix.lat, lon: fix.lon, t: fix.t, acc: fix.acc }); while (warm.length > 2 && fix.t - warm[0].t > START.maxWindowMs + 5000) warm.shift();
  const i = detectStart(warm, w.kind); if (i < 0) return true; // accepted, still waiting
  const run = warm.slice(i); startNow(w, run[0].t); for (const f of run) addFix(w, f);
  return true;
}

/** Adds one GPS fix {lat, lon, t, acc}. Returns true when it was accepted (rejected: inaccurate, impossible jump, out of order, paused). */
export function addFix(w, fix) {
  if (isPaused(w) || isFinished(w) || !validPoint(fix) || !Number.isFinite(fix.t)) return false;
  if (Number.isFinite(fix.acc) && fix.acc > LIMITS.maxAccuracyM) return false;
  if (isWaiting(w)) return waitFix(w, fix);
  const prev = w.last;
  if (prev) {
    const dt = fix.t - prev.t;
    if (dt <= 0) return false;
    const d = haversine(prev, fix), v = d / (dt / 1000);
    if (v > LIMITS.maxSpeedMps) return false;
    if (v >= LIMITS.movingMps) { // standing still adds neither distance nor moving time (and kills GPS jitter)
      const before = w.distanceM;
      w.distanceM += d; w.movingMs += dt;
      for (let km = Math.floor(before / 1000) + 1; km * 1000 <= w.distanceM; km++) { // split time interpolated inside this step
        const f = (km * 1000 - before) / d;
        w.splits.push({ km, atMs: Math.round(w.movingMs - dt * (1 - f)) });
      }
    }
  }
  w.last = { lat: fix.lat, lon: fix.lon, t: fix.t };
  w.recent.push([fix.lat, fix.lon, fix.t]); while (w.recent.length > 2 && fix.t - w.recent[0][2] > LIMITS.paceWindowMs + 5000) w.recent.shift();
  if (w.points.length < LIMITS.maxPoints) w.points.push([Math.round(fix.lat * 1e6) / 1e6, Math.round(fix.lon * 1e6) / 1e6, fix.t]);
  return true;
}

export const MAX_MARKS = 50;
/**
 * "Mark a point": remembers where you are and the totals so far (distance, moving and elapsed time, pace) and keeps measuring. Returns the mark, or null when there is no position
 * yet, the workout is waiting / paused / finished, or the last mark is under 3 s old.
 */
export function addMark(w, now) {
  if (!w.last || isWaiting(w) || isPaused(w) || isFinished(w) || w.marks.length >= MAX_MARKS) return null;
  const prev = w.marks[w.marks.length - 1]; if (prev && now - prev.t < 3000) return null;
  const m = { n: w.marks.length + 1, lat: w.last.lat, lon: w.last.lon, t: now, distM: Math.round(w.distanceM), movingMs: Math.round(w.movingMs), elapsedMs: Math.round(elapsedMs(w, now)), paceSec: Math.round(recentPaceSec(w) || avgPaceSec(w)) };
  w.marks.push(m); return m;
}
/** Marks -> table rows: the totals at the point and the stretch since the previous mark (or the start): [{ n, distM, elapsedMs, paceSec, segM, segMs, segPaceSec }]. */
export function markRows(marks) {
  let pd = 0, pm = 0; return marks.map((m) => { const segM = Math.max(0, m.distM - pd), segMs = Math.max(0, m.movingMs - pm); pd = m.distM; pm = m.movingMs; return { n: m.n, distM: m.distM, elapsedMs: m.elapsedMs, paceSec: m.distM >= 20 ? Math.round(m.movingMs / 1000 / (m.distM / 1000)) : 0, segM, segMs, segPaceSec: segM >= 20 ? Math.round(segMs / 1000 / (segM / 1000)) : 0, lat: m.lat, lon: m.lon }; });
}
/** Untrusted marks -> a safe list (at most MAX_MARKS, valid positions, clamped numbers, numbered 1..n). */
export function sanitizeMarks(list) {
  if (!Array.isArray(list)) return [];
  const num = (v, hi) => (Number.isFinite(v) ? clamp(v, 0, hi) : 0);
  return list.slice(0, 500).filter((m) => m && validPoint({ lat: m.lat, lon: m.lon })).slice(0, MAX_MARKS).map((m, i) => ({ n: i + 1, lat: m.lat, lon: m.lon, t: num(m.t, 4e12), distM: Math.round(num(m.distM, 1e7)), movingMs: Math.round(num(m.movingMs, 1e9)), elapsedMs: Math.round(num(m.elapsedMs, 1e9)), paceSec: Math.round(num(m.paceSec, 3600)) }));
}

/** Average pace in seconds per km over the whole moving time (0 when unknown). */
export const avgPaceSec = (w) => (w.distanceM >= 20 ? w.movingMs / 1000 / (w.distanceM / 1000) : 0);

/** Current pace over the last ~30 s of fixes since the last pause (seconds per km, 0 when unknown/standing). */
export function recentPaceSec(w) {
  const r = w.recent; if (r.length < 2) return 0;
  const last = r[r.length - 1]; let i = r.length - 2;
  while (i > 0 && last[2] - r[i][2] < LIMITS.paceWindowMs) i--;
  const first = r[i], dt = (last[2] - first[2]) / 1000; if (dt < 5) return 0;
  const d = haversine({ lat: first[0], lon: first[1] }, { lat: last[0], lon: last[1] });
  return d >= 5 ? dt / (d / 1000) : 0;
}

/** True when the person seems to have stopped: the last ~30 s of fixes barely moved and the newest fix is fresh (used to OFFER a pause, never to pause by itself). */
export function stoppedFor(w, now) {
  const r = w.recent; if (r.length < 3 || isPaused(w) || isFinished(w)) return false;
  const first = r[0], last = r[r.length - 1];
  if (now - last[2] > 15000 || last[2] - first[2] < 28000) return false;
  return haversine({ lat: first[0], lon: first[1] }, { lat: last[0], lon: last[1] }) < 10;
}

/** Rough energy estimate: kcal ~ MET x kg x hours (walk 3.5, run 9.8). Weight is optional (default 70 kg). */
export function kcal(w, weightKg = 70) {
  const kg = clamp(Number(weightKg) || 70, 30, 250);
  return Math.round((w.kind === 'run' ? 9.8 : 3.5) * kg * (w.movingMs / 3600000));
}

/** Compact record for history: no heavy fields, safe to store. */
export function summarize(w) {
  return { kind: w.kind, startedAt: w.startedAt, endedAt: w.endedAt, elapsedMs: Math.round(elapsedMs(w, w.endedAt)), distanceM: Math.round(w.distanceM), movingMs: Math.round(w.movingMs), splits: w.splits.slice(0, 500), points: w.points, ...(w.marks?.length ? { marks: sanitizeMarks(w.marks) } : {}) };
}

/** Untrusted record (restore/storage) -> a safe record, or null. */
export function sanitizeWorkout(r) {
  if (!r || typeof r !== 'object') return null;
  const num = (v, lo, hi) => (Number.isFinite(v) ? clamp(v, lo, hi) : 0);
  const kind = LIMITS.kinds.includes(r.kind) ? r.kind : 'walk';
  const startedAt = num(r.startedAt, 0, 4e12); if (!startedAt) return null;
  const points = Array.isArray(r.points) ? r.points.slice(0, LIMITS.maxPoints).filter((p) => Array.isArray(p) && validPoint({ lat: p[0], lon: p[1] }) && Number.isFinite(p[2])).map((p) => [p[0], p[1], p[2]]) : [];
  const splits = Array.isArray(r.splits) ? r.splits.slice(0, 500).filter((s) => s && Number.isFinite(s.km) && Number.isFinite(s.atMs)).map((s) => ({ km: s.km | 0, atMs: Math.max(0, s.atMs | 0) })) : [];
  const wx = r.weather && typeof r.weather === 'object' && Number.isFinite(r.weather.tempC) ? { tempC: clamp(r.weather.tempC, -60, 60), cond: ['clear', 'cloudy', 'rain', 'windy'].includes(r.weather.cond) ? r.weather.cond : 'clear' } : null;
  const routeId = /^r[a-z0-9]{3,24}$/.test(String(r.routeId)) ? r.routeId : '';
  return { kind, startedAt, endedAt: num(r.endedAt, 0, 4e12), elapsedMs: num(r.elapsedMs, 0, 1e9), distanceM: num(r.distanceM, 0, 1e7), movingMs: num(r.movingMs, 0, 1e9), splits, points, ...(r.marks ? { marks: sanitizeMarks(r.marks) } : {}), ...(wx ? { weather: wx } : {}), ...(routeId ? { routeId } : {}) };
}

/** Untrusted saved in-progress workout -> a safe live workout, or null. */
export function sanitizeActive(r) {
  const rec = sanitizeWorkout({ ...r, endedAt: 0 }); if (!rec) return null;
  const w = newWorkout(rec.kind, rec.startedAt);
  const n = (v, hi) => (Number.isFinite(v) ? clamp(v, 0, hi) : 0);
  w.marks = sanitizeMarks(r.marks); w.waiting = r.waiting === true; // an older saved workout was measuring from its start
  Object.assign(w, { pausedMs: n(r.pausedMs, 1e9), pausedAt: n(r.pausedAt, 4e12), distanceM: rec.distanceM, movingMs: rec.movingMs, splits: rec.splits, points: rec.points });
  const lp = rec.points[rec.points.length - 1]; w.last = lp && !w.pausedAt ? { lat: lp[0], lon: lp[1], t: lp[2] } : null;
  return w;
}
