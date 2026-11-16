// The numbers the workout screen can show next to the big distance (pure): the person picks two in Settings.
import { recentPaceSec, avgPaceSec, kcal, elapsedMs } from './workout.js';
import { fmtPace, fmtClock } from './format.js';

export const METRICS = ['pace', 'speed', 'time', 'avg', 'lastkm', 'kcal', 'cadence'];
/** The picture beside each number's caption. */
export const METRIC_ICON = { pace: 'gauge-pace', speed: 'gauge-speed', time: 'stopwatch', avg: 'avgpace', lastkm: 'lastkm', kcal: 'calories', cadence: 'cadence' };
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

/** Where the needle of the speed / pace gauge points, in degrees from -120 (slow) to +120 (fast); null for numbers that have no gauge. Speed 0..20 km/h, pace 10:00..3:30 per km. */
export function gaugeDeg(id, w) {
  if (id !== 'speed' && id !== 'pace') return null;
  const ps = w ? recentPaceSec(w) : 0; if (!(ps > 0)) return -120;
  const v = id === 'speed' ? (3600 / ps) / 20 : (600 - ps) / (600 - 210);
  return Math.round(-120 + 240 * Math.min(1, Math.max(0, v)));
}
