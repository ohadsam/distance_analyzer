// Pure step estimation and "quality" weighting. Raw steps are only the start: a brisk, continuous bout counts for more than shuffling
// around, because that is what the effort bar rewards. (A passive all-day step counter comes with the Android step sensor; until then
// steps are estimated from tracked workouts.)
import { clamp } from './util.js';
import { speedKmh, dayStart } from './stats.js';

/** Steps in a workout from distance and the person's height (stride = a fraction of height that is longer when running). */
export function estimateSteps(w, heightCm = 170) {
  const h = clamp(heightCm, 100, 230) / 100, stride = h * (w.kind === 'run' ? 0.62 : 0.413);
  return Math.round(w.distanceM / stride);
}

/** Weight of a workout's steps by intensity (speed) and continuity (an unbroken bout). */
export function qualityFactor(w) {
  const v = speedKmh(w), minutes = w.movingMs / 60000, flow = w.elapsedMs > 0 ? w.movingMs / w.elapsedMs : 1;
  const speed = v < 3 ? 0.5 : v < 4.5 ? 0.8 : v < 6.5 ? 1 : 1.2;
  const bout = v < 3 ? 1 : minutes >= 30 && flow >= 0.9 ? 1.2 : minutes >= 10 && flow >= 0.85 ? 1.1 : 1; // strolling earns no continuity bonus
  return Math.round(speed * bout * 100) / 100;
}

/** One day's step picture from its workouts: raw, quality-weighted, brisk (steps at a brisk pace) and the longest continuous distance. */
export function daySteps(workouts, heightCm = 170) {
  let steps = 0, quality = 0, brisk = 0, longestM = 0, activeMs = 0;
  for (const w of workouts) {
    const s = estimateSteps(w, heightCm), f = qualityFactor(w);
    steps += s; quality += Math.round(s * f); if (speedKmh(w) >= 4.5) brisk += s;
    longestM = Math.max(longestM, w.distanceM); activeMs += w.movingMs;
  }
  return { steps, quality, brisk, longestM, activeMin: Math.round(activeMs / 60000) };
}

/** Per-day series for the last `days` days (oldest first): [{ t, steps, quality, brisk, longestM, activeMin }]. */
export function stepSeries(rows, days, now, heightCm) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(dayStart(now)); d.setDate(d.getDate() - i); const t = d.getTime();
    out.push({ t, ...daySteps(rows.filter((w) => dayStart(w.startedAt) === t), heightCm) });
  }
  return out;
}

/** General daily-steps guidance by age (rounded, public guidance ranges) - a starting point, personalised below. */
export const baseDailySteps = (age) => (age < 18 ? 12000 : age >= 65 ? 7000 : 8000);

/** Recommended steps for today: the person's recent typical quality steps +10 %, kept within 50-150 % of the age base. */
export function recommendedSteps(series, age) {
  const base = baseDailySteps(age), active = series.filter((d) => d.quality > 0).map((d) => d.quality).sort((a, b) => a - b);
  if (active.length < 3) return base;
  const median = active[active.length >> 1];
  return Math.round(clamp(median * 1.1, base * 0.5, base * 1.5) / 100) * 100;
}
