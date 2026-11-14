// Pure workout model: GPS fixes in, distance / moving time / pace / km splits out. Plain serialisable objects; time is always passed in.
import { haversine, validPoint } from './geo.js';
import { clamp } from './util.js';

export const LIMITS = { maxAccuracyM: 35, maxSpeedMps: 12, movingMps: 0.5, paceWindowMs: 30000, maxPoints: 20000, kinds: ['walk', 'run'] };

export function newWorkout(kind, now) {
  return { kind: LIMITS.kinds.includes(kind) ? kind : 'walk', startedAt: now, endedAt: 0, pausedMs: 0, pausedAt: 0, distanceM: 0, movingMs: 0, splits: [], points: [], last: null };
}

export const isPaused = (w) => w.pausedAt > 0;
export const isFinished = (w) => w.endedAt > 0;

export function pause(w, now) { if (!isPaused(w) && !isFinished(w)) w.pausedAt = now; return w; }
export function resume(w, now) { if (isPaused(w)) { w.pausedMs += now - w.pausedAt; w.pausedAt = 0; w.last = null; } return w; } // last=null: no distance is added across the gap
export function finish(w, now) { if (isPaused(w)) resume(w, now); if (!isFinished(w)) w.endedAt = now; return w; }

/** Wall-clock time of the workout without paused time. */
export function elapsedMs(w, now) {
  const end = w.endedAt || (w.pausedAt || now);
  return Math.max(0, end - w.startedAt - w.pausedMs);
}

/** Adds one GPS fix {lat, lon, t, acc}. Returns true when it was accepted (rejected: inaccurate, impossible jump, out of order, paused). */
export function addFix(w, fix) {
  if (isPaused(w) || isFinished(w) || !validPoint(fix) || !Number.isFinite(fix.t)) return false;
  if (Number.isFinite(fix.acc) && fix.acc > LIMITS.maxAccuracyM) return false;
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
  if (w.points.length < LIMITS.maxPoints) w.points.push([Math.round(fix.lat * 1e6) / 1e6, Math.round(fix.lon * 1e6) / 1e6, fix.t]);
  return true;
}

/** Average pace in seconds per km over the whole moving time (0 when unknown). */
export const avgPaceSec = (w) => (w.distanceM >= 20 ? w.movingMs / 1000 / (w.distanceM / 1000) : 0);

/** Current pace over the last ~30 s of accepted fixes (seconds per km, 0 when unknown/standing). */
export function recentPaceSec(w) {
  const pts = w.points; if (pts.length < 2) return 0;
  const last = pts[pts.length - 1]; let i = pts.length - 2;
  while (i > 0 && last[2] - pts[i][2] < LIMITS.paceWindowMs) i--;
  const a = pts[i], dt = (last[2] - a[2]) / 1000; if (dt < 5) return 0;
  const d = haversine({ lat: a[0], lon: a[1] }, { lat: last[0], lon: last[1] });
  return d >= 5 ? dt / (d / 1000) : 0;
}

/** Rough energy estimate: kcal ~ MET x kg x hours (walk 3.5, run 9.8). Weight is optional (default 70 kg). */
export function kcal(w, weightKg = 70) {
  const kg = clamp(Number(weightKg) || 70, 30, 250);
  return Math.round((w.kind === 'run' ? 9.8 : 3.5) * kg * (w.movingMs / 3600000));
}

/** Compact record for history: no heavy fields, safe to store. */
export function summarize(w) {
  return { kind: w.kind, startedAt: w.startedAt, endedAt: w.endedAt, distanceM: Math.round(w.distanceM), movingMs: Math.round(w.movingMs), splits: w.splits.slice(0, 500), points: w.points };
}

/** Untrusted record (restore/storage) -> a safe record, or null. */
export function sanitizeWorkout(r) {
  if (!r || typeof r !== 'object') return null;
  const num = (v, lo, hi) => (Number.isFinite(v) ? clamp(v, lo, hi) : 0);
  const kind = LIMITS.kinds.includes(r.kind) ? r.kind : 'walk';
  const startedAt = num(r.startedAt, 0, 4e12); if (!startedAt) return null;
  const points = Array.isArray(r.points) ? r.points.slice(0, LIMITS.maxPoints).filter((p) => Array.isArray(p) && validPoint({ lat: p[0], lon: p[1] }) && Number.isFinite(p[2])).map((p) => [p[0], p[1], p[2]]) : [];
  const splits = Array.isArray(r.splits) ? r.splits.slice(0, 500).filter((s) => s && Number.isFinite(s.km) && Number.isFinite(s.atMs)).map((s) => ({ km: s.km | 0, atMs: Math.max(0, s.atMs | 0) })) : [];
  return { kind, startedAt, endedAt: num(r.endedAt, 0, 4e12), distanceM: num(r.distanceM, 0, 1e7), movingMs: num(r.movingMs, 0, 1e9), splits, points };
}

/** Untrusted saved in-progress workout -> a safe live workout, or null. */
export function sanitizeActive(r) {
  const rec = sanitizeWorkout({ ...r, endedAt: 0 }); if (!rec) return null;
  const w = newWorkout(rec.kind, rec.startedAt);
  const n = (v, hi) => (Number.isFinite(v) ? clamp(v, 0, hi) : 0);
  Object.assign(w, { pausedMs: n(r.pausedMs, 1e9), pausedAt: n(r.pausedAt, 4e12), distanceM: rec.distanceM, movingMs: rec.movingMs, splits: rec.splits, points: rec.points });
  const lp = rec.points[rec.points.length - 1]; w.last = lp && !w.pausedAt ? { lat: lp[0], lon: lp[1], t: lp[2] } : null;
  return w;
}
