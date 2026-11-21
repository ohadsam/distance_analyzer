// Turn-by-turn guidance for a route (pure: no DOM, no network, time and position passed in). The turns are found in the route's own geometry (so any saved route, planned or drawn, can
// be followed); `createNav` then follows the person along the line: the next turn and its distance, what remains, whether they left the route, and which spoken cue is due.
import { haversine } from './geo.js';
import { distToPath } from './route.js';

const rad = (d) => d * Math.PI / 180;
const bearing = (a, b) => { const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0])), x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1])); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; };
const angDiff = (a, b) => ((b - a + 540) % 360) - 180; // + = turned right (clockwise)
const d2 = (a, b) => haversine({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] });

/** The path resampled every `step` metres: [{ p: [lat, lon], s: metres from the start }] (the last point is always included). */
export function resample(path, step = 15) {
  if (!Array.isArray(path) || path.length < 2) return [];
  const out = [{ p: path[0], s: 0 }]; let acc = 0, next = step;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], len = d2(a, b); if (len <= 0) continue;
    while (acc + len >= next) { const f = (next - acc) / len; out.push({ p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], s: next }); next += step; }
    acc += len;
  }
  if (out[out.length - 1].s < acc - 1) out.push({ p: path[path.length - 1], s: acc });
  return out;
}
export const lengthOf = (path) => { let m = 0; for (let i = 1; i < path.length; i++) m += d2(path[i - 1], path[i]); return m; };
const kindOf = (a) => { const m = Math.abs(a); return m >= 165 ? 'uturn' : m >= 120 ? 'sharp' : m >= 60 ? '' : 'slight'; };

/**
 * The turns of a route: [{ distM (from the start), lat, lon, dir: 'left' | 'right' | 'slight-left' | ... | 'uturn', angle }]. A turn is a change of heading of 30 degrees or more
 * between the 45 m before and the 45 m after a point; a curve is reported once, at its sharpest point, and wobble of the line (under 30 degrees) is ignored.
 */
export function turnsOf(path, { minAngle = 30 } = {}) {
  const r = resample(path, 15), W = 3, out = []; if (r.length < 2 * W + 1) return out;
  let group = null;
  const flush = () => { if (group) { const k = group.k, side = group.a > 0 ? 'right' : 'left', kind = kindOf(group.a); out.push({ distM: Math.round(r[k].s), lat: r[k].p[0], lon: r[k].p[1], dir: kind === 'uturn' ? 'uturn' : kind ? `${kind}-${side}` : side, angle: Math.round(group.a) }); group = null; } };
  for (let k = W; k < r.length - W; k++) {
    const a = angDiff(bearing(r[k - W].p, r[k].p), bearing(r[k].p, r[k + W].p));
    if (Math.abs(a) >= minAngle) { if (group && Math.sign(a) === Math.sign(group.a) && r[k].s - r[group.last].s <= 20) { group.last = k; if (Math.abs(a) > Math.abs(group.a)) { group.a = a; group.k = k; } } else { flush(); group = { a, k, last: k }; } } else if (group && r[k].s - r[group.last].s > 20) flush();
  }
  flush(); return out;
}

/** Human steps: [{ type: 'start' } | { type: 'turn', dir, distM (since the previous step), atM } | { type: 'arrive', distM }]. */
export function stepsOf(turns, totalM) {
  const out = [{ type: 'start' }]; let prev = 0;
  for (const tn of turns) { out.push({ type: 'turn', dir: tn.dir, distM: tn.distM - prev, atM: tn.distM, lat: tn.lat, lon: tn.lon }); prev = tn.distM; }
  out.push({ type: 'arrive', distM: Math.max(0, totalM - prev), atM: totalM }); return out;
}

/** Distance in words' numbers: under a kilometre in steps of 10 / 50 m, then km with one decimal: { value, unit: 'm' | 'km' }. */
export function roundDist(m) {
  if (m < 1000) { const v = m < 100 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50; return v >= 1000 ? { value: 1, unit: 'km' } : { value: Math.max(10, v), unit: 'm' }; }
  return { value: Math.round(m / 100) / 10, unit: 'km' };
}

/**
 * Follows a route. `update({ lat, lon })` -> { progressM, remainingM, next: { turn, distM } | null, after: { turn, distM } | null, offM, off, arrived }.
 * The position is matched to the stretch around the last progress (a loop that ends where it starts must not jump to the end); `off` = more than `offAt` metres from the line.
 */
export function createNav(path, turns = turnsOf(path), { offAt = 45, arriveAt = 25 } = {}) {
  const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + d2(path[i - 1], path[i])); const total = cum[cum.length - 1] || 0;
  let seg = 0;
  function project(pos) {
    const lat0 = pos[0], k = 111320, kx = k * Math.cos(rad(lat0)), xy = (p) => [(p[1] - pos[1]) * kx, (p[0] - pos[0]) * k]; let best = { d: Infinity, i: seg, f: 0 };
    for (let i = Math.max(1, seg - 2); i < Math.min(path.length, seg + 40); i++) {
      const [ax, ay] = xy(path[i - 1]), [bx, by] = xy(path[i]), dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)), d = Math.hypot(ax + f * dx, ay + f * dy);
      if (d < best.d) best = { d, i, f };
    }
    if (best.d > offAt * 3) { for (let i = 1; i < path.length; i++) { const [ax, ay] = xy(path[i - 1]), [bx, by] = xy(path[i]), dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)), d = Math.hypot(ax + f * dx, ay + f * dy); if (d < best.d) best = { d, i, f }; } } // lost: look at the whole line
    return best;
  }
  return {
    total, turns,
    update(pos) {
      if (path.length < 2) return { progressM: 0, remainingM: 0, next: null, after: null, offM: 0, off: false, arrived: true };
      const b = project([pos.lat, pos.lon]); seg = b.i; const progressM = cum[b.i - 1] + (cum[b.i] - cum[b.i - 1]) * b.f, remainingM = Math.max(0, total - progressM);
      const ahead = turns.filter((tn) => tn.distM > progressM + 5), nx = ahead[0], af = ahead[1];
      return { progressM, remainingM, next: nx ? { turn: nx, distM: nx.distM - progressM } : null, after: af ? { turn: af, distM: af.distM - progressM } : null, offM: Math.round(b.d), off: b.d > offAt, arrived: remainingM <= arriveAt && b.d <= offAt * 2 };
    },
  };
}

/**
 * The spoken cue due now, or null: { key, dir?, distM? } with `key` one of 'ahead' (about 200 m before a turn), 'now' (about 30 m), 'off', 'back' (on the route again), 'arrive'.
 * `said` is a Set the caller keeps (it remembers what was already said); `nowMs` is used for the off-route repeat (every 30 s).
 */
export function cueOf(st, said, nowMs = Date.now()) {
  if (st.arrived) { if (!said.has('arrive')) { said.add('arrive'); return { key: 'arrive' }; } return null; }
  if (st.off) { const last = said.get ? said.get('offAt') : 0; if (!said.has('off') || nowMs - (last || 0) > 30000) { said.add('off'); said.set?.('offAt', nowMs); return { key: 'off', distM: st.offM }; } return null; }
  if (said.has('off')) { said.delete('off'); return { key: 'back' }; }
  const n = st.next; if (!n) return null; const id = `${n.turn.distM}`;
  if (n.distM <= 35 && !said.has(`${id}:now`)) { said.add(`${id}:now`); said.add(`${id}:ahead`); return { key: 'now', dir: n.turn.dir }; }
  if (n.distM <= 220 && n.distM > 60 && !said.has(`${id}:ahead`)) { said.add(`${id}:ahead`); return { key: 'ahead', dir: n.turn.dir, distM: n.distM }; }
  return null;
}
/** A Set that also remembers a few numbers (the off-route repeat time): what `cueOf` expects. */
export const newSaid = () => { const s = new Set(), m = new Map(); s.get = (k) => m.get(k); s.set = (k, v) => { m.set(k, v); return s; }; return s; };
export { distToPath };
