// Routes: save a recorded path as a route, recognise it next time, show progress on it, suggest the best route for now, manage routes
// (rename, one-time, delete), and the quick-action buttons. Geometry/statistics live in route.js and routeReco.js (pure).
import { emptyState } from '../art.js';
import { h, setChildren, median } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon, trackSvg } from '../icons.js';
import { listRoutes, saveRoute, deleteRoute, listWorkouts, updateWorkout, getPref } from '../store.js';
import { makeRoute, matchRoute, MIN_ROUTE_M, MAX_ROUTES } from '../route.js';
import { attemptsOf, routeProgress, bestContext, recommendRoutes, mainKind } from '../routeReco.js';
import { weatherOfHour } from '../forecast.js';
import { projectTrack } from '../geo.js';
import { paceSec, weatherBucket } from '../stats.js';
import { fmtKm, fmtPaceUnit, fmtDate, bucketLabel } from '../format.js';
import { lineChart } from '../charts.js';
import { cachedForecast, onlineOn } from '../weatherApi.js';
import { workoutRow } from './home.js';

const BAND_KEY = { morning: 'bandMorning', midday: 'bandMidday', evening: 'bandEvening', night: 'bandNight' };
const say = (msg) => { const sr = document.getElementById('sr'); if (sr) sr.textContent = msg; };
const newId = () => `r${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

// ---------- data operations ----------
export async function saveRouteFromWorkout(rec, name, oneTime) {
  const routes = await listRoutes(); if (routes.length >= MAX_ROUTES) return null;
  const route = await saveRoute(makeRoute(rec.points, { id: newId(), name, oneTime }));
  if (route) await updateWorkout(rec.startedAt, { routeId: route.id });
  return route;
}
/** Links earlier workouts that followed this route (user-triggered: it scans every saved track). Returns how many were linked. */
export async function linkEarlier(route) {
  let n = 0;
  for (const w of await listWorkouts()) if (!w.routeId && w.points.length >= 5 && matchRoute(w.points, route).ok) { await updateWorkout(w.startedAt, { routeId: route.id }); n++; }
  return n;
}
/** The saved route a track followed (best match), or null. */
export const findRoute = (points, routes) => routes.map((r) => ({ r, m: matchRoute(points, r) })).filter((x) => x.m.ok).sort((a, b) => a.m.avg - b.m.avg)[0]?.r || null;

// ---------- suggestions ----------
function typicalDistance(rows, kind) { const d = rows.filter((w) => !kind || w.kind === kind).slice(0, 20).map((w) => w.distanceM); return d.length >= 3 ? median(d) : 0; }
export function suggest(routes, rows, now = Date.now()) {
  const kind = getPref('recoKind', 'walk') === 'run' ? 'run' : 'walk', f = onlineOn() ? cachedForecast(now) : null, hr = f?.find((x) => now >= x.t && now < x.t + 3600000);
  return recommendRoutes(routes, rows, { now, hour: new Date(now).getHours(), kind, typicalM: typicalDistance(rows, kind), weather: hr ? weatherBucket(weatherOfHour(hr)) : 'none' });
}
export const suggestionCard = (s) => h('a', { class: 'item routecard', href: `#/r/${s.route.id}`, 'data-route-suggestion': s.route.id }, h('span', { class: 'kind' }, icon('route', 24)),
  h('span', { class: 'grow' }, h('b', null, s.route.name), h('small', null, s.reasons.length ? s.reasons.map((k) => t(k, s.params)).join(' · ') : `${fmtKm(s.route.lengthM)} · ${t('routeTimes', { n: s.n })}`)), icon('forward', 20));

// ---------- cards ----------
function routeCard(route, rows) {
  const at = attemptsOf(route, rows), pr = routeProgress(at);
  return h('a', { class: 'item routecard', href: `#/r/${route.id}`, 'data-route': route.id }, h('span', { class: 'kind' }, icon('route', 24)),
    h('span', { class: 'grow' }, h('b', null, route.name, route.oneTime ? h('span', { class: 'tag' }, ` · ${t('routeOneTimeBadge')}`) : null), h('small', null, `${fmtKm(route.lengthM)} · ${t('routeTimes', { n: at.length })}${pr.best ? ` · ${t('routeBest', { pace: fmtPaceUnit(paceSec(pr.best)) })}` : ''}`)), icon('forward', 20));
}

/** Quick actions: measure now (starts at once, last activity), my routes, and the suggested route when there is one. */
export function quickActions(suggested) {
  const kind = getPref('recoKind', 'walk') === 'run' ? 'run' : 'walk';
  return h('div', { class: 'quick', role: 'group', 'aria-label': t('quickActions') },
    h('a', { class: 'quick-main', href: `#/workout/${kind}/go`, id: 'qa-measure' }, icon('gps', 32), h('span', null, h('b', null, t('qaMeasure')), h('small', null, t('qaMeasureHint')))),
    h('a', { class: 'quick-btn', href: '#/routes', id: 'qa-routes' }, icon('route', 24), t('qaRoutes')),
    suggested ? h('a', { class: 'quick-btn', href: `#/r/${suggested.id}`, id: 'qa-suggested' }, icon('star', 24), `${t('qaSuggested')}: ${suggested.name}`) : null);
}

// ---------- the box shown after a workout is saved ----------
export function summaryBox(rec, followId = '') {
  const box = h('div', { class: 'routebox', 'aria-live': 'polite' });
  (async () => {
    const routes = await listRoutes(), stored = rec.routeId ? routes.find((r) => r.id === rec.routeId) : null;
    // the stored link wins; a followed route counts only when the path really matched it; otherwise look for a matching saved route
    const followed = followId && !stored ? routes.find((r) => r.id === followId && matchRoute(rec.points, r).ok) : null, found = stored || followed || findRoute(rec.points, routes);
    if (found) {
      if (rec.routeId !== found.id) await updateWorkout(rec.startedAt, { routeId: found.id });
      const rows = await listWorkouts({ points: false }), at = attemptsOf(found, rows, rec.kind), upto = at.filter((w) => w.startedAt <= rec.startedAt), before = upto.filter((w) => w.startedAt !== rec.startedAt), me = upto.find((w) => w.startedAt === rec.startedAt), lines = [h('p', null, h('b', null, t('routeRecognised', { name: found.name })))];
      if (me) { // compared with the attempts BEFORE this one, so an old workout viewed later reads the same as it did on the day
        lines.push(h('p', null, t('routeNth', { n: upto.length })));
        if (before.length && paceSec(me) < Math.min(...before.map(paceSec))) lines.push(h('p', { class: 'good' }, t('routePB')));
        else if (before.length >= 2) { const pct = Math.round(((median(before.map(paceSec)) - paceSec(me)) / median(before.map(paceSec))) * 100); if (Math.abs(pct) >= 1) lines.push(h('p', null, t(pct > 0 ? 'routeFaster' : 'routeSlowerThis', { pct: Math.abs(pct) }))); }
      }
      setChildren(box, h('h2', null, t('routeOf')), ...lines, h('a', { class: 'btn ghost', href: `#/r/${found.id}` }, t('details'))); return;
    }
    if (rec.points.length < 5 || rec.distanceM < MIN_ROUTE_M || routes.length >= MAX_ROUTES) return;
    const name = h('input', { type: 'text', id: 'route-name', maxLength: 40, value: `${t(rec.kind)} ${fmtDate(rec.startedAt, getLang())}`, 'aria-label': t('routeNameLabel') });
    const once = h('input', { type: 'checkbox', id: 'route-once' });
    setChildren(box, h('h2', null, t('routeSaveTitle')), h('p', { class: 'note' }, t('routeSaveHint')), h('div', { class: 'field' }, h('label', { for: 'route-name' }, t('routeNameLabel')), name),
      h('label', { class: 'check' }, once, h('span', null, t('routeOneTimeLabel'))),
      h('div', { class: 'row-actions' }, h('button', { type: 'button', class: 'btn', id: 'route-save', onclick: async () => { const r = await saveRouteFromWorkout(rec, name.value, once.checked); if (r) { say(t('routeSaved')); setChildren(box, h('p', null, h('b', null, t('routeSaved'))), h('a', { class: 'btn ghost', href: `#/r/${r.id}` }, t('details'))); } } }, t('routeSave')),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => setChildren(box) }, t('routeNotNow'))));
  })();
  return box;
}

// ---------- routes list ----------
export async function routesBody(box, filter = 'all', redraw) {
  const [routes, rows] = [await listRoutes(), await listWorkouts({ points: false })]; if (box.alive === false) return;
  const sug = suggest(routes, rows).slice(0, 3), shown = routes.filter((r) => filter === 'all' || (filter === 'once') === r.oneTime);
  const chip = (id, key) => h('button', { type: 'button', class: 'chip', 'data-filter': id, 'aria-pressed': String(filter === id), onclick: () => { box.dataset.filter = id; redraw?.(); } }, t(key));
  setChildren(box, h('div', { class: 'chips', role: 'group' }, chip('all', 'routeAll'), chip('regular', 'routeRegular'), chip('once', 'routeOneTime')),
    sug.length ? h('div', { class: 'rlist' }, h('h2', null, t('routeRecTitle')), sug.map(suggestionCard)) : (routes.length ? h('p', { class: 'note' }, t('routeRecNone')) : null),
    shown.length ? h('div', { class: 'list' }, shown.map((r) => routeCard(r, rows))) : emptyState('no-routes', t('routesNone')));
}
export function renderRoutes() {
  const box = h('div', { class: 'routesbox' }), el = h('section', { class: 'routes' }, h('h1', null, t('routesTitle')), quickActions(null), box);
  const draw = () => { box.alive = true; routesBody(box, box.dataset.filter || 'all', draw); };
  draw(); el.cleanup = () => { box.alive = false; }; return el;
}

// ---------- one route ----------
export function renderRoute(id) {
  const el = h('section', { class: 'route' });
  async function draw() {
    const [routes, rows] = [await listRoutes(), await listWorkouts({ points: false })]; if (el.alive === false) return;
    const route = routes.find((r) => r.id === id); if (!route) { location.hash = '#/routes'; return; }
    const mk = mainKind(route, rows), all = attemptsOf(route, rows), at = attemptsOf(route, rows, mk), pr = routeProgress(at), ctx = bestContext(at); // walks and runs are not compared with each other
    const row = (k, v) => h('div', { class: 'row' }, h('span', null, k), h('b', null, v));
    const verdict = pr.trend === 'improving' ? t('routeImproving', { pct: Math.abs(pr.improvePct) }) : pr.trend === 'slower' ? t('routeSlower', { pct: Math.abs(pr.improvePct) }) : pr.trend === 'steady' ? t('routeSteady') : t('routeNew');
    const nameIn = h('input', { type: 'text', id: 'route-rename', maxLength: 40, value: route.name, 'aria-label': t('routeNameLabel') });
    const kind = mk;
    setChildren(el, h('a', { class: 'link back', href: '#/routes' }, icon('back', 20), t('routesTitle')), h('h1', null, route.name, route.oneTime ? h('span', { class: 'tag' }, ` · ${t('routeOneTimeBadge')}`) : null),
      trackSvg(projectTrack(route.path, 300, 180)),
      h('div', { class: 'rows' }, row(t('distance'), fmtKm(route.lengthM)), row(t('routeAttempts'), String(all.length)), pr.best ? row(t('recFastest'), fmtPaceUnit(paceSec(pr.best))) : null, pr.n ? row(t('avgPace'), fmtPaceUnit(pr.avgPaceSec)) : null),
      h('h2', null, t('routeProgressTitle')), at.length >= 2 ? lineChart(at.map(paceSec)) : null, h('p', null, verdict),
      ctx.band || ctx.weather ? h('p', { class: 'note' }, `${ctx.band ? t('routeBestAt', { band: t(BAND_KEY[ctx.band]) }) : ''} ${ctx.weather ? t('routeBestIn', { weather: bucketLabel(ctx.weather) }) : ''}`.trim()) : null,
      h('a', { class: 'btn', id: 'route-go', href: `#/workout/${kind}/go/r/${route.id}` }, icon('play', 20), t('routeStart')),
      all.length ? h('div', { class: 'list' }, h('h2', null, t('routeAttempts')), [...all].reverse().map((w) => workoutRow(w))) : null, h('p', { class: 'note' }, t('mapNote')),
      h('div', { class: 'field' }, h('label', { for: 'route-rename' }, t('routeRename')), nameIn, h('button', { type: 'button', class: 'btn ghost', id: 'route-rename-save', onclick: async () => { await saveRoute({ ...route, name: nameIn.value }); say(t('routeSaved')); draw(); } }, t('routeSave'))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'route-onetime', checked: route.oneTime, onchange: async (e) => { await saveRoute({ ...route, oneTime: e.target.checked }); draw(); } }), h('span', null, t('routeOneTimeLabel'))),
      h('div', { class: 'row-actions' }, h('button', { type: 'button', class: 'btn ghost', id: 'route-link', onclick: async () => { const n = await linkEarlier(route); say(t('routeLinked', { n })); draw(); } }, t('routeLinkOld')),
        h('button', { type: 'button', class: 'btn danger', id: 'route-delete', onclick: async () => { if (confirm(t('routeDeleteAsk'))) { await deleteRoute(route.id); location.hash = '#/routes'; } } }, icon('trash', 20), t('routeDelete'))));
  }
  draw(); el.cleanup = () => { el.alive = false; }; return el;
}
