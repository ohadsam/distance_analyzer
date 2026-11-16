// The route planner's orchestration: ask for several candidate routes, correct them towards the requested distance, enrich the best with climb and
// street data, rank. Pure of the network: `api` = { route(points), elevation(path), tags(path) } is passed in (planApi.js in the app, fakes in tests).
// Every enrichment may fail (offline, rate limit): the route is then still offered, with that fact missing and said so.
import { simplify } from './route.js';
import { viaSets, scaleVia, elevationStats, classifyRoute, countCrossings, rankRoutes, MIN_TARGET_M, MAX_TARGET_M } from './routePlan.js';
import { clamp } from './util.js';

/** Run `fn` over `items`, at most `n` at a time; failures become null. */
export async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; try { out[i] = await fn(items[i], i); } catch { out[i] = null; } } }));
  return out;
}
const ok = (r) => r && Array.isArray(r.path) && r.path.length >= 2 && Number.isFinite(r.distanceM) && r.distanceM > 0;

/**
 * req: { start: [lat, lon], end: [lat, lon] | null (= back to the start), targetM, prefs }.
 * Returns { routes (ranked, best first), notes: { elevation, streets, tried } } - or { routes: [], notes } when nothing could be routed.
 */
export async function planRoutes(req, api, onProgress = () => {}) {
  const targetM = clamp(req.targetM, MIN_TARGET_M, MAX_TARGET_M), start = req.start, end = req.end || req.start;
  const sets = viaSets(start, end, targetM); onProgress('routes', 0, sets.length);
  let done = 0;
  const first = await pool(sets, 3, async (s) => { const r = await api.route([start, ...s.via, end]); onProgress('routes', ++done, sets.length); return ok(r) ? { id: s.id, via: s.via, path: simplify(r.path, 400), distanceM: r.distanceM } : null; });
  // the first guess about how winding the streets are is rarely right: stretch or shrink the ones that missed by more than 12%
  const again = first.map((c, i) => (c && c.via.length && Math.abs(c.distanceM - targetM) / targetM > 0.12 ? { c, i } : null)).filter(Boolean);
  if (again.length) {
    const fixed = await pool(again, 3, async ({ c }) => { const via = scaleVia(start, end, c.via, clamp(targetM / c.distanceM, 0.55, 1.7)), r = await api.route([start, ...via, end]); return ok(r) ? { id: `${c.id}b`, via, path: simplify(r.path, 400), distanceM: r.distanceM } : null; });
    again.forEach(({ i }, k) => { const f = fixed[k]; if (f && Math.abs(f.distanceM - targetM) < Math.abs(first[i].distanceM - targetM)) first[i] = f; });
  }
  const cands = first.filter(Boolean).sort((a, b) => Math.abs(a.distanceM - targetM) - Math.abs(b.distanceM - targetM)).slice(0, 7);
  const notes = { elevation: false, streets: false, tried: sets.length, found: cands.length };
  if (!cands.length) return { routes: [], notes };
  done = 0; onProgress('details', 0, cands.length);
  const extra = await pool(cands, 2, async (c) => {
    const [el, tg] = await Promise.all([api.elevation(c.path).catch(() => null), api.tags(c.path).catch(() => null)]); onProgress('details', ++done, cands.length);
    return { el, tg };
  });
  cands.forEach((c, i) => {
    const { el, tg } = extra[i] || {}, st = el ? elevationStats(el.elev, c.path) : null;
    Object.assign(c, { ascentM: st ? st.ascentM : null, descentM: st ? st.descentM : null, steepestPct: st ? st.steepestPct : null, elev: el ? el.elev : null });
    const cr = tg ? countCrossings(c.path, tg.crossings) : null;
    Object.assign(c, { crossings: cr ? cr.crossings : null, signalled: cr ? cr.signalled : null, surface: tg ? classifyRoute(c.path, tg.ways) : null });
    if (st) notes.elevation = true; if (tg) notes.streets = true;
  });
  return { routes: rankRoutes(cands, { targetM, prefs: req.prefs }), notes };
}
