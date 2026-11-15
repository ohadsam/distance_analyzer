// Pure live indications during a workout: "almost at your last distance", "new distance record", "kilometre faster than last time", "your fastest
// kilometre yet". Compared with the person's OWN earlier workouts of the same kind (no saved route needed). Each indication fires once per workout.
import { clamp } from './util.js';

/** References from earlier workouts (newest first) of this kind: { last, longest, bestKmMs }. The current workout must not be among `rows`. */
export function references(rows, kind) {
  const same = rows.filter((w) => w.kind === kind && w.distanceM >= 200);
  let longest = null, bestKmMs = 0;
  for (const w of same) {
    if (!longest || w.distanceM > longest.distanceM) longest = w;
    (w.splits || []).forEach((s, i) => { const ms = s.atMs - (i ? w.splits[i - 1].atMs : 0); if (ms > 0 && (!bestKmMs || ms < bestKmMs)) bestKmMs = ms; });
  }
  return { last: same[0] || null, longest, bestKmMs };
}

const near = (refM) => clamp(refM * 0.05, 80, 250); // "almost there": within 5 % of the reference, between 80 and 250 m
const splitMs = (splits, i) => (splits[i] ? splits[i].atMs - (i ? splits[i - 1].atMs : 0) : 0);

/**
 * state: { distM, splits: [{ km, atMs }] }. fired: a Set of ids already shown (mutated). Returns [{ id, key, params }] for what is new now.
 * Keys: indLastNear, indLastPassed, indRecNear, indRecPassed, indKmFaster, indKmBest.
 */
export function indicators(state, refs, fired = new Set()) {
  const out = [], add = (id, key, params) => { if (!fired.has(id)) { fired.add(id); out.push({ id, key, params }); } };
  const { last, longest } = refs, d = state.distM;
  if (longest && d > longest.distanceM + 20) add('recPassed', 'indRecPassed', {});
  else if (longest && longest.distanceM - d <= near(longest.distanceM) && longest.distanceM - d > 0 && (!last || Math.abs(longest.distanceM - last.distanceM) > 300)) add('recNear', 'indRecNear', { m: Math.round((longest.distanceM - d) / 10) * 10 });
  const same = last && longest && Math.abs(longest.distanceM - last.distanceM) <= 300; // the last workout IS the record: one message is enough
  if (last && !same && d > last.distanceM + 20) add('lastPassed', 'indLastPassed', {});
  else if (last && last.distanceM - d <= near(last.distanceM) && last.distanceM - d > 0) add('lastNear', 'indLastNear', { m: Math.round((last.distanceM - d) / 10) * 10 });
  const n = state.splits.length;
  if (n) { // the newest kilometre
    const ms = splitMs(state.splits, n - 1), k = state.splits[n - 1].km;
    if (refs.bestKmMs && ms > 0 && ms < refs.bestKmMs) add(`km-${k}-best`, 'indKmBest', { k });
    else { const prev = last && last.splits ? splitMs(last.splits, n - 1) : 0; if (prev && ms > 0 && prev - ms >= 3000) add(`km-${k}-faster`, 'indKmFaster', { k, s: Math.round((prev - ms) / 1000) }); }
  }
  return out;
}
