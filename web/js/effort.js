// Pure effort-bar engine: weekly targets from age and history, and an honest check of every finished workout against them.
// Targets follow public guidance (WHO 2020: children 5-17 about 60 active minutes a day; adults and seniors 150-300 moderate minutes a week)
// and grow gently from what the person really does. General guidance, not medical advice. All text is produced by the UI from keys.
import { clamp } from './util.js';
import { speedKmh, weekStart, WEEK } from './stats.js';

export const GUIDE = { child: { floor: 420, ceiling: 420 }, adult: { floor: 150, ceiling: 300 }, senior: { floor: 150, ceiling: 300 } };
export const guideFor = (age) => (age < 18 ? GUIDE.child : age >= 65 ? GUIDE.senior : GUIDE.adult);
export const MAX_RAISE = 0.10, MAX_RAISE_STEADY = 0.12; // the bar may rise at most this much per week

/** "Moderate-equivalent minutes" of a workout: running counts double, a brisk walk once, a stroll less, a very slow one not at all. */
export function effortMinutes(w) {
  const min = w.movingMs / 60000, v = speedKmh(w);
  if (w.kind === 'run') return min * 2;
  return min * (v < 3 ? 0 : v < 4.5 ? 0.5 : 1);
}
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Effort minutes per complete week for the `weeks` weeks before the current one (oldest first). */
export function weeklyEffort(rows, now, weeks = 4) {
  const cur = weekStart(now), out = [];
  for (let i = weeks; i >= 1; i--) { const d = new Date(cur); d.setDate(d.getDate() - 7 * i); const t = d.getTime(); out.push({ t, min: rows.filter((w) => weekStart(w.startedAt) === t).reduce((s, w) => s + effortMinutes(w), 0), n: rows.filter((w) => weekStart(w.startedAt) === t).length }); }
  return out;
}

/**
 * The plan for the current week. Beginners start at 60 % of the guideline floor; after that the bar follows the MEDIAN of the last weeks
 * (so one huge week cannot drag it up) +10 % (12 % when the last three weeks were all active), never above the guideline ceiling.
 * Returns { minutes, floor, ceiling, typical, longestMin, longestM, steady, raisePct }.
 */
export function weeklyTarget(rows, age, now, override = null) {
  const g = guideFor(age), weeks = weeklyEffort(rows, now, 4), active = weeks.filter((x) => x.min > 0), typical = median(active.map((x) => x.min));
  const steady = weeks.slice(-3).every((x) => x.n >= 2), raise = steady ? MAX_RAISE_STEADY : MAX_RAISE;
  const start = Math.round(g.floor * 0.6);
  const minutes = active.length ? Math.round(clamp(typical * (1 + raise), start, g.ceiling)) : start;
  const recent = rows.filter((w) => w.startedAt >= now - 28 * 86400000 && w.startedAt < weekStart(now) + WEEK);
  const set = override && override.week === weekStart(now) && override.minutes > 0 ? Math.round(clamp(override.minutes, 30, g.ceiling)) : 0; // the person's own gentle raise for this week
  return { minutes: set || minutes, overridden: !!set, computed: minutes, floor: g.floor, ceiling: g.ceiling, typical: Math.round(typical), steady, raisePct: Math.round(raise * 100),
    longestMin: Math.round(Math.max(0, ...recent.map((w) => w.movingMs / 60000))), longestM: Math.max(0, ...recent.map((w) => w.distanceM)) };
}

/** Effort minutes for the last `n` weeks including the current one (oldest first): [{ t, min }]. */
export function weeklySeries(rows, now, n = 8) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(weekStart(now)); d.setDate(d.getDate() - 7 * i); const t = d.getTime(); out.push({ t, min: Math.round(rows.filter((w) => weekStart(w.startedAt) === t).reduce((s, w) => s + effortMinutes(w), 0)) }); }
  return out;
}

/** Effort minutes so far in the week containing `now`. */
export const weekProgress = (rows, now) => rows.filter((w) => weekStart(w.startedAt) === weekStart(now)).reduce((s, w) => s + effortMinutes(w), 0);

/**
 * Checks a finished workout against the plan built from the history BEFORE it. Returns null when it is within the plan, otherwise
 * { id, level: 'notice'|'warn', params, newTarget } where `id` is 'long' | 'fast' | 'surge' (the UI words it from i18n keys).
 *  - long:  distance or time at least 1.5x the longest of the last four weeks (needs a real history: at least 3 earlier workouts)
 *  - fast:  a run at least 20 % faster than the typical run pace
 *  - surge: this week's effort already beyond 130 % of the weekly bar
 * `newTarget` is the gentler raise of the bar that the run supports: at most +10 % (and a fifth of how far over the plan it went).
 */
export function checkWorkout(w, before, age, now) {
  if (before.length < 3) return null;
  const plan = weeklyTarget(before, age, now), g = guideFor(age);
  const recent = before.filter((x) => x.startedAt >= now - 28 * 86400000);
  const longestM = Math.max(1, ...recent.map((x) => x.distanceM)), longestMin = Math.max(1, ...recent.map((x) => x.movingMs / 60000));
  const ratio = Math.max(w.distanceM / longestM, w.movingMs / 60000 / longestMin);
  const gentle = (over) => Math.min(g.ceiling, Math.round(plan.minutes * (1 + Math.min(MAX_RAISE, Math.max(0, over - 1) * 0.2))));
  if (ratio >= 1.5 && w.movingMs / 60000 >= 15) return { id: 'long', level: ratio >= 2 ? 'warn' : 'notice', params: { ratio: Math.round(ratio * 100), km: (w.distanceM / 1000).toFixed(1), typicalKm: (longestM / 1000).toFixed(1), min: Math.round(w.movingMs / 60000) }, plan: plan.minutes, newTarget: gentle(ratio) };
  const runs = recent.filter((x) => x.kind === 'run' && x.distanceM >= 1000 && x.movingMs > 0);
  if (w.kind === 'run' && runs.length >= 3 && w.distanceM >= 1000) {
    const pace = (x) => x.movingMs / x.distanceM, typical = median(runs.map(pace)), over = typical / pace(w);
    if (over >= 1.2) return { id: 'fast', level: over >= 1.35 ? 'warn' : 'notice', params: { pct: Math.round((over - 1) * 100) }, plan: plan.minutes, newTarget: gentle(over) };
  }
  const week = weekProgress([...before, w], now), surge = week / plan.minutes;
  if (surge >= 1.3 && week > plan.minutes + 20) return { id: 'surge', level: surge >= 1.6 ? 'warn' : 'notice', params: { done: Math.round(week), plan: plan.minutes, pct: Math.round(surge * 100) }, plan: plan.minutes, newTarget: gentle(surge) };
  return null;
}

/** The status of the week so far: 'ahead' | 'on' | 'behind' with the share done and the day of the week used. */
export function weekStatus(rows, age, now, override = null) {
  const plan = weeklyTarget(rows, age, now, override), done = weekProgress(rows, now), day = new Date(now).getDay(), expected = plan.minutes * Math.min(1, (day + 1) / 7);
  const share = done / plan.minutes;
  return { plan, done: Math.round(done), share, status: share >= 1 ? 'ahead' : done >= expected * 0.8 ? 'on' : 'behind' };
}
