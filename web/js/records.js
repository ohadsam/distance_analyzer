// Which personal records a finished workout broke (pure). Needs earlier workouts of the same kind: the first ones have nothing to beat.
import { references } from './indicators.js';
import { paceSec } from './stats.js';

const kmTimes = (w) => (w.splits || []).map((s, i) => s.atMs - (i ? w.splits[i - 1].atMs : 0)).filter((ms) => ms > 0);

/** prior: workout summaries (any kind, the new one excluded); w: the finished workout. Returns [{ id: 'distance' | 'pace' | 'km', value, prev }], best first. */
export function brokenRecords(prior, w) {
  const same = prior.filter((r) => r.kind === w.kind && r.startedAt !== w.startedAt), out = [];
  if (!same.length || !(w.distanceM >= 1000)) return out; // too short to be a record, or nothing to beat yet
  const refs = references(same, w.kind);
  if (refs.longest && w.distanceM > refs.longest.distanceM + 20) out.push({ id: 'distance', value: w.distanceM, prev: refs.longest.distanceM });
  const paces = same.filter((r) => r.distanceM >= 1000).map(paceSec).filter((p) => p > 0), mine = paceSec(w);
  if (paces.length && mine > 0 && mine < Math.min(...paces) - 2) out.push({ id: 'pace', value: mine, prev: Math.min(...paces) });
  const km = kmTimes(w); if (km.length && refs.bestKmMs && Math.min(...km) < refs.bestKmMs - 2000) out.push({ id: 'km', value: Math.min(...km), prev: refs.bestKmMs });
  return out;
}

/** Which workouts were a record when they were done: Map(startedAt -> ['distance' | 'pace' | 'km', ...]) (oldest first, each against what came before). */
export function recordFlags(rows) {
  const asc = [...rows].sort((a, b) => a.startedAt - b.startedAt), out = new Map();
  for (let i = 0; i < asc.length; i++) { const r = brokenRecords(asc.slice(0, i), asc[i]); if (r.length) out.set(asc[i].startedAt, r.map((x) => x.id)); }
  return out;
}
