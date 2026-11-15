// Pure route statistics and recommendations: how the person's performance on each route developed, where they perform best (hour of day,
// weather), and which route to suggest now. One-time routes (a trip, a holiday) never take part. Needs workouts with `routeId`.
import { paceSec, DAY, weatherBucket } from './stats.js';
import { median } from './util.js';

export const hourBand = (ts) => { const h = new Date(ts).getHours(); return h < 11 ? 'morning' : h < 16 ? 'midday' : h < 20 ? 'evening' : 'night'; };
export const BANDS = ['morning', 'midday', 'evening', 'night'];

/** The workouts that followed this route, oldest first (needs a measurable pace). With `kind`, only walks or only runs: their paces are not comparable. */
export const attemptsOf = (route, rows, kind = '') => rows.filter((w) => w.routeId === route.id && paceSec(w) > 0 && (!kind || w.kind === kind)).sort((a, b) => a.startedAt - b.startedAt);
/** The activity done most often on a route (ties: the most recent). */
export function mainKind(route, rows) { const at = rows.filter((w) => w.routeId === route.id); const n = { walk: 0, run: 0 }; at.forEach((w) => { n[w.kind]++; }); return n.run > n.walk ? 'run' : n.walk > n.run ? 'walk' : (at.sort((a, b) => b.startedAt - a.startedAt)[0]?.kind || 'walk'); }

/** Speed index of each attempt = route median pace / attempt pace (1.00 = typical for this route, above 1 = faster than usual). */
export function speedIndexes(attempts) {
  const m = median(attempts.map(paceSec)); return attempts.map((w) => ({ w, idx: m / paceSec(w) }));
}

/**
 * Progress on a route: best attempt, how the pace moved (first three vs last three, in %), and a verdict. Needs >= 2 attempts for a trend.
 * { n, best, last, avgPaceSec, improvePct (positive = faster now), trend: 'improving' | 'steady' | 'slower' | 'new' }
 */
export function routeProgress(attempts) {
  if (!attempts.length) return { n: 0, trend: 'new' };
  const paces = attempts.map(paceSec), best = attempts.reduce((b, w) => (paceSec(w) < paceSec(b) ? w : b));
  if (attempts.length < 2) return { n: 1, best, last: attempts[0], avgPaceSec: paces[0], improvePct: 0, trend: 'new' };
  const k = Math.min(3, Math.floor(attempts.length / 2)), early = median(paces.slice(0, k)), late = median(paces.slice(-k)), pct = Math.round(((early - late) / early) * 1000) / 10;
  return { n: attempts.length, best, last: attempts[attempts.length - 1], avgPaceSec: median(paces), improvePct: pct, trend: pct >= 2 ? 'improving' : pct <= -2 ? 'slower' : 'steady' };
}

/** Where the person does best on this route: the hour band and weather bucket with the highest median speed index (needs >= 2 attempts in it). */
export function bestContext(attempts) {
  const si = speedIndexes(attempts), group = (keyOf) => { const g = new Map(); for (const { w, idx } of si) { const k = keyOf(w); if (k && k !== 'none') (g.get(k) || g.set(k, []).get(k)).push(idx); } return [...g].filter(([, v]) => v.length >= 2).map(([k, v]) => [k, median(v), v.length]).sort((a, b) => b[1] - a[1]); };
  const band = group((w) => hourBand(w.startedAt))[0], wx = group((w) => weatherBucket(w.weather))[0];
  return { band: band && band[1] > 1.005 ? band[0] : '', weather: wx && wx[1] > 1.005 ? wx[0] : '' };
}

/**
 * Routes to suggest now. ctx = { now, hour (start hour of the planned activity), weather (bucket or 'none'), typicalM (usual distance), kind ('walk'|'run'|'') }.
 * Score 0..100 = performance in a similar context (45) + how often it is done (20) + fit to the usual length (20) + not done too recently (15).
 * Returns [{ route, score, reasons: [keys], params, n }] best first; one-time routes and routes without attempts are skipped.
 */
export function recommendRoutes(routes, rows, ctx) {
  const out = [], band = hourBand(new Date(ctx.now).setHours(ctx.hour ?? new Date(ctx.now).getHours(), 30, 0, 0));
  for (const route of routes) {
    if (route.oneTime) continue;
    const at = attemptsOf(route, rows).filter((w) => !ctx.kind || w.kind === ctx.kind); if (!at.length) continue;
    const si = speedIndexes(at), same = si.filter(({ w }) => hourBand(w.startedAt) === band), sameWx = ctx.weather && ctx.weather !== 'none' ? si.filter(({ w }) => weatherBucket(w.weather) === ctx.weather) : [];
    const perf = (list) => (list.length ? median(list.map((x) => x.idx)) : 1), pBand = perf(same), pWx = perf(sameWx);
    const ctxPerf = clamp01(0.5 + ((same.length ? pBand : 1) + (sameWx.length ? pWx : 1) - 2) * 4); // 0.5 = neutral; +/-12 % faster/slower moves it to the ends
    const freq = Math.min(1, at.length / 8), fit = typeof ctx.typicalM === 'number' && ctx.typicalM > 0 ? clamp01(1 - Math.abs(route.lengthM - ctx.typicalM) / ctx.typicalM) : 0.5;
    const days = (ctx.now - at[at.length - 1].startedAt) / DAY, rest = days < 1 ? 0.2 : days < 2 ? 0.6 : days <= 14 ? 1 : 0.7;
    const score = Math.round(100 * (0.45 * ctxPerf + 0.2 * freq + 0.2 * fit + 0.15 * rest));
    const reasons = [];
    if (same.length >= 2 && pBand > 1.01) reasons.push('rr_band'); if (sameWx.length >= 2 && pWx > 1.01) reasons.push('rr_weather');
    if (at.length >= 4) reasons.push('rr_often'); if (fit >= 0.75) reasons.push('rr_length'); if (days >= 3 && days <= 14) reasons.push('rr_rested');
    out.push({ route, score, reasons, n: at.length, params: { band, n: at.length, km: (route.lengthM / 1000).toFixed(1), days: Math.floor(days), pct: Math.round(((same.length ? pBand : 1) - 1) * 100) } });
  }
  return out.sort((a, b) => b.score - a.score);
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
