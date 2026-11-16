// The numbers the workout screen can show next to the big distance (pure): the person picks two in Settings.
import { recentPaceSec, avgPaceSec, kcal, elapsedMs } from './workout.js';
import { fmtPace, fmtClock } from './format.js';

export const METRICS = ['pace', 'speed', 'time', 'avg', 'lastkm', 'kcal', 'cadence'];
export const DEFAULT_METRICS = ['pace', 'time'];
/** Any stored value -> a valid pair of metric ids. */
export const metricPair = (a, b) => { const x = METRICS.includes(a) ? a : DEFAULT_METRICS[0]; let y = METRICS.includes(b) ? b : DEFAULT_METRICS[1]; if (y === x) y = METRICS.find((m) => m !== x); return [x, y]; };

/** { cap: string key, unit: string key or '', text } for one metric; ctx: { now, weightKg, bpm }. */
export function metricValue(id, w, ctx) {
  const ps = w ? recentPaceSec(w) : 0;
  switch (id) {
    case 'speed': return { cap: 'wkSpeed', text: ps > 0 ? (3600 / ps).toFixed(1) : '–' };
    case 'time': return { cap: 'time', text: fmtClock(w ? elapsedMs(w, ctx.now) : 0) };
    case 'avg': return { cap: 'avgPace', text: w && avgPaceSec(w) ? fmtPace(avgPaceSec(w)) : '–' };
    case 'lastkm': { const s = w?.splits || [], n = s.length; return { cap: 'wkLastKm', text: n ? fmtClock(s[n - 1].atMs - (n > 1 ? s[n - 2].atMs : 0)) : '–' }; }
    case 'kcal': return { cap: 'kcal', text: w ? String(kcal(w, ctx.weightKg || 70)) : '0' };
    case 'cadence': return { cap: 'wkCadence', text: ctx.bpm > 0 ? String(Math.round(ctx.bpm)) : '–' };
    default: return { cap: 'pace', unit: 'perKm', text: fmtPace(ps) };
  }
}
