// The dashboard: customisable widgets (show/hide/reorder), filters (period, activity, weather, text) and drill-down (each widget opens a
// detail view). Data logic lives in stats/steps/effort (pure); this file only arranges and draws.
import { art } from '../art.js';
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { active, listWorkouts, listRoutes, profile, getJson, setJson, getPref, setPref } from '../store.js';
import { alertStore, unreadCount } from '../alerts.js';
import { fmtKm, fmtPace, fmtPaceUnit, fmtClock, fmtDate, workoutText, bucketLabel } from '../format.js';
import { filterWorkouts, totals, bucketize, streak, personalBests, paceByWeather, paceSec, weatherBucket, WEATHER_BUCKETS, DAY, dayStart } from '../stats.js';
import { stepSeries, recommendedSteps } from '../steps.js';
import { weeklyTarget, weekStatus, weeklySeries } from '../effort.js';
import { barChart, lineChart } from '../charts.js';
import { native } from '../native.js';
import { workoutRow } from './home.js';
import { recoSummary, mountReco } from './reco.js';
import { quickActions, routesBody, suggest } from './routes.js';
import { planSummary, mountPlan } from './plan.js';

export const WIDGETS = ['effort', 'plan', 'reco', 'routes', 'steps', 'distance', 'pace', 'consistency', 'weather', 'records', 'alerts'];
const PERIODS = { 7: 'p7', 30: 'p30', 365: 'p365', 0: 'pAll' };
export const W_KEY = { effort: 'wEffort', reco: 'wReco', routes: 'wRoutes', plan: 'wPlan', steps: 'wSteps', distance: 'wDistance', pace: 'wPace', consistency: 'wConsistency', weather: 'wWeather', records: 'wRecords', alerts: 'wAlerts' };

// ---------- saved layout and filters (untrusted storage: only known values pass) ----------
// a new person sees the essentials; everything else is one tap away in Customise
const DEFAULT_HIDDEN = ['pace', 'consistency', 'records', 'alerts'];
// only for a brand-new install (nothing saved, no workouts, welcome not yet answered): existing people keep every widget
export function loadLayout() {
  const raw = getJson('dash', {}), order = Array.isArray(raw.order) ? raw.order.filter((x, i, a) => WIDGETS.includes(x) && a.indexOf(x) === i) : [];
  for (const id of WIDGETS) if (!order.includes(id)) order.push(id);
  return { order, hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((x) => WIDGETS.includes(x)) : [] };
}
export function loadFilter() {
  const f = getJson('dashF', {});
  return { days: Object.hasOwn(PERIODS, f.days) ? +f.days : 30, kind: f.kind === 'walk' || f.kind === 'run' ? f.kind : '', weather: WEATHER_BUCKETS.includes(f.weather) ? f.weather : '', text: typeof f.text === 'string' ? f.text.slice(0, 40) : '' };
}
const saveFilter = (f) => setJson('dashF', f);

/** Everything the widgets need, computed once per draw. */
export async function loadContext(now = Date.now()) {
  const all = await listWorkouts({ points: false }), prof = profile(), f = loadFilter(), ov = getJson('barOv', null);
  const rows = filterWorkouts(all, { since: f.days ? now - f.days * DAY : 0, kind: f.kind, weather: f.weather, text: f.text }, workoutText);
  return { all, rows, f, now, prof, ov, plan: weeklyTarget(all, prof.age, now, ov), status: weekStatus(all, prof.age, now, ov), steps: stepSeries(all, 14, now, prof.heightCm, native.stepsDays()), alerts: alertStore.load(), routes: await listRoutes() };
}

// ---------- widgets: summary (on the dashboard) and detail (drill-down) ----------
const stat = (big, small) => h('div', { class: 'stat' }, h('b', { class: 'big' }, big), small ? h('small', null, small) : null);
const meter = (share, label) => h('div', { class: 'meter', role: 'img', 'aria-label': label }, h('span', { style: { 'inline-size': `${Math.min(100, Math.round(share * 100))}%` } }));
const none = () => h('p', { class: 'note' }, t('drillNone'));
const row = (k, v) => h('div', { class: 'row' }, h('span', null, k), h('b', null, v));
const weekLabel = (ts) => new Date(ts).toLocaleDateString(getLang() === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'numeric' });
const dayLabel = (ts) => String(new Date(ts).getDate());

export const W = {
  effort: {
    summary: (c) => h('div', null, stat(t('effortOf', { done: c.status.done, plan: c.plan.minutes }), t(c.status.status === 'ahead' ? 'effAhead' : c.status.status === 'on' ? 'effOn' : 'effBehind')), meter(c.status.share, t('effortOf', { done: c.status.done, plan: c.plan.minutes }))),
    detail: (c) => [barChart(weeklySeries(c.all, c.now, 8).map((x, i, a) => ({ v: x.min, label: weekLabel(x.t), cls: i === a.length - 1 ? 'now' : '' })), { target: c.plan.minutes }),
      h('div', { class: 'rows' }, row(t('thisWeek'), t('effortOf', { done: c.status.done, plan: c.plan.minutes })), row(t('effTypical', { n: c.plan.typical }), ''), c.plan.overridden ? row(t('barOverride', { n: c.plan.minutes }), '') : null),
      h('p', { class: 'note' }, t('effRange', { floor: c.plan.floor, ceiling: c.plan.ceiling })), h('p', { class: 'note' }, t('effHow', { pct: c.plan.raisePct }))],
  },
  steps: {
    summary: (c) => { const today = c.steps[c.steps.length - 1], rec = recommendedSteps(c.steps, c.prof.age); return h('div', null, stat(today.quality.toLocaleString(getLang() === 'he' ? 'he-IL' : 'en-GB'), t('stepsGoal', { n: rec.toLocaleString(getLang() === 'he' ? 'he-IL' : 'en-GB') })), meter(today.quality / rec, t('stepsQuality'))); },
    detail: (c) => { const today = c.steps[c.steps.length - 1], rec = recommendedSteps(c.steps, c.prof.age); return [barChart(c.steps.map((d, i) => ({ v: d.quality, label: dayLabel(d.t), cls: i === c.steps.length - 1 ? 'now' : '' })), { target: rec }),
      h('div', { class: 'rows' }, row(t('stepsQuality'), String(today.quality)), row(t('stepsRaw'), String(today.steps)), today.sensor ? row(t('stepsPhone'), '') : null, row(t('stepsBrisk'), String(today.brisk)), row(t('stepsGoal', { n: rec }), ''), row(t('stepsLongest', { km: (today.longestM / 1000).toFixed(1) }), '')), h('p', { class: 'note' }, t('stepsHow'))]; },
  },
  distance: {
    summary: (c) => { const tt = totals(c.rows); return h('div', null, stat(fmtKm(tt.distanceM), t('count', { n: tt.n })), barChart(bucketize(c.rows, 'day', 7, c.now).map((b) => ({ v: b.distanceM / 1000 })), { h: 60 })); },
    detail: (c) => [barChart(bucketize(c.rows, 'week', 12, c.now).map((b) => ({ v: b.distanceM / 1000, label: weekLabel(b.t) }))), h('div', { class: 'rows' }, row(t('total'), fmtKm(totals(c.rows).distanceM)), row(t('time'), fmtClock(totals(c.rows).movingMs)))],
  },
  pace: {
    summary: (c) => { const ps = c.rows.filter((w) => paceSec(w) > 0).slice(0, 12).reverse(), best = Math.min(...ps.map(paceSec)); return ps.length ? h('div', null, stat(fmtPaceUnit(ps.reduce((s, w) => s + paceSec(w), 0) / ps.length), ps.length > 1 ? t('paceBest', { pace: fmtPace(best) }) : ''), lineChart(ps.map(paceSec), { h: 60 })) : none(); },
    detail: (c) => { const ps = c.rows.filter((w) => paceSec(w) > 0).slice(0, 24).reverse(); return ps.length ? [h('p', { class: 'note' }, t('paceTrend')), lineChart(ps.map(paceSec))] : [none()]; },
  },
  consistency: {
    summary: (c) => { const days = new Set(c.all.map((w) => dayStart(w.startedAt))), cells = []; for (let i = 27; i >= 0; i--) { const d = new Date(dayStart(c.now)); d.setDate(d.getDate() - i); cells.push(h('i', { class: days.has(d.getTime()) ? 'on' : '' })); }
      const s = streak(c.all, c.now); return h('div', null, stat(t('consDays', { n: cells.filter((x) => x.className === 'on').length }), s ? t('consStreak', { n: s }) : t('consNone')), h('div', { class: 'heat', 'aria-hidden': 'true' }, cells)); },
    detail: (c) => { const days = new Set(c.all.map((w) => dayStart(w.startedAt))), cells = []; for (let i = 83; i >= 0; i--) { const d = new Date(dayStart(c.now)); d.setDate(d.getDate() - i); cells.push(h('i', { class: days.has(d.getTime()) ? 'on' : '' })); } return [h('div', { class: 'heat big', 'aria-hidden': 'true' }, cells), h('p', { class: 'note' }, t('consDays', { n: cells.filter((x) => x.className === 'on').length }))]; },
  },
  weather: {
    summary: (c) => { const r = paceByWeather(c.rows); return r.length ? h('div', { class: 'rows flat' }, r.map((x) => row(bucketLabel(x.bucket), t('wxPaceLine', { pace: fmtPaceUnit(x.paceSec), n: x.n })))) : h('p', { class: 'note' }, t('wxNoData')); },
    detail: (c) => { const r = paceByWeather(c.rows); return [r.length ? barChart(r.map((x) => ({ v: Math.max(...r.map((y) => y.paceSec)) * 1.1 - x.paceSec, label: bucketLabel(x.bucket).split(' ')[0] }))) /* taller = faster, scaled from the data */ : null, r.length ? h('div', { class: 'rows' }, r.map((x) => row(bucketLabel(x.bucket), t('wxPaceLine', { pace: fmtPaceUnit(x.paceSec), n: x.n })))) : h('p', { class: 'note' }, t('wxNoData'))]; },
  },
  records: {
    summary: (c) => { const pb = personalBests(c.rows); return pb.longest ? h('div', { class: 'rows flat' }, row(t('recLongest'), fmtKm(pb.longest.distanceM)), pb.fastest ? row(t('recFastest'), fmtPaceUnit(paceSec(pb.fastest))) : null, pb.bestKm ? row(t('recBestKm'), fmtClock(pb.bestKm.ms)) : null) : h('p', { class: 'note' }, t('recNone')); },
    detail: (c) => [W.records.summary(c)],
  },
  plan: {
    summary: (c) => planSummary(c.now),
    detail: () => { const box = h('div', { class: 'planbox' }); mountPlan(box); return [box]; },
  },
  routes: {
    summary: (c) => { const top = suggest(c.routes, c.all)[0]; return c.routes.length ? h('div', null, stat(String(c.routes.length), top ? `${t('qaSuggested')}: ${top.route.name}` : t('routeRecNone'))) : h('p', { class: 'note' }, t('routesNone')); },
    detail: () => { const box = h('div', { class: 'routesbox' }); const draw = () => { box.alive = true; routesBody(box, box.dataset.filter || 'all', draw); }; draw(); return [box]; },
  },
  reco: {
    summary: (c) => recoSummary(c),
    detail: () => { const box = h('div', { class: 'recobox' }); const draw = () => { box.alive = true; mountReco(box, 'all', { redraw: draw }); }; draw(); return [box]; },
  },
  alerts: {
    summary: (c) => { const l = c.alerts.slice(0, 2); return l.length ? h('div', { class: 'rows flat' }, l.map((a) => row(t(a.title, a.params), a.read ? '' : '●'))) : h('p', { class: 'note' }, t('alertsEmpty')); },
    detail: () => [h('a', { class: 'btn', href: '#/alerts' }, t('alertsTitle'))],
  },
};

// ---------- filter bar ----------
let filtersOpen = false; // the filters stay folded until someone opens them (or one is active)
function filterBar(c, redraw) {
  const f = { ...c.f }, upd = (k, v) => { f[k] = v; saveFilter(f); redraw(); };
  const sel = (label, key, opts) => h('label', { class: 'fsel' }, h('span', { class: 'cap' }, label), h('select', { onchange: (e) => upd(key, key === 'days' ? +e.target.value : e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(f[key]) }, l))));
  const active = (f.days !== 30 ? 1 : 0) + (f.kind ? 1 : 0) + (f.weather ? 1 : 0) + (f.text ? 1 : 0);
  return h('details', { class: 'fold', open: filtersOpen || active > 0 }, h('summary', { onclick: (e) => { filtersOpen = !e.currentTarget.parentElement.open; } }, t('filtersTitle'), active ? ` (${active})` : ''), h('div', { class: 'filters', role: 'group', 'aria-label': t('period') },
    sel(t('period'), 'days', Object.entries(PERIODS).map(([d, k]) => [d, t(k)])), sel(t('kind'), 'kind', [['', t('kindAll')], ['walk', t('walk')], ['run', t('run')]]),
    sel(t('weatherFilter'), 'weather', [['', t('weatherAll')], ...WEATHER_BUCKETS.map((b) => [b, bucketLabel(b)])]),
    h('label', { class: 'fsel grow' }, h('span', { class: 'cap' }, t('filterText')), h('input', { type: 'search', value: f.text, maxLength: 40, onchange: (e) => upd('text', e.target.value.trim()) }))));
}

// first run: one friendly card (age fits the effort bar to you); gone after one tap and never shown to people who already have workouts
function welcome(c, redraw) {
  if (getPref('welcomed', '') || c.all.length) return null;
  const done = () => { setPref('welcomed', '1'); redraw(); };
  const age = h('input', { id: 'welcome-age', type: 'number', inputMode: 'numeric', min: 5, max: 100, value: getPref('age', '') || '', placeholder: '35' });
  return h('div', { class: 'card welcome', id: 'welcome' }, art('onboarding', 'welcome'), h('h2', null, t('welcomeTitle')), h('p', null, t('welcomeText')),
    h('label', { for: 'welcome-age' }, t('age')), age,
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', id: 'welcome-ok', onclick: () => { const a = Number(age.value); if (a >= 5 && a <= 100) setPref('age', Math.round(a)); done(); } }, t('welcomeOk')), h('button', { type: 'button', class: 'btn ghost', onclick: done }, t('welcomeSkip'))));
}

export function renderDashboard() {
  const el = h('section', { class: 'dash' });
  let editing = false, seq = 0;
  async function draw() {
    const mine = ++seq, c = await loadContext(); if (el.alive === false || mine !== seq) return; // only the newest draw may paint (fast taps start several)
    const resume = active.load(); // read on every draw: a discard must show at once
    const startLink = (kind) => h('a', { class: `start-card ${kind}`, href: `#/workout/${kind}`, onclick: (e) => { if (!active.load()) return; if (confirm(t('replaceAsk'))) active.clear(); else e.preventDefault(); } }, icon(kind, 36), h('b', null, t(kind === 'walk' ? 'startWalk' : 'startRun')));
    if (!getPref('dash', '') && !getPref('welcomed', '') && !c.all.length) setJson('dash', { order: [...WIDGETS], hidden: [...DEFAULT_HIDDEN] });
    const layout = loadLayout();
    const change = (fn) => { const L = loadLayout(); fn(L); setJson('dash', L); draw(); }; // always from the saved layout, so a fast second tap never works on a stale copy
    const move = (id, d) => change((L) => { const i = L.order.indexOf(id), j = i + d; if (j >= 0 && j < L.order.length) [L.order[i], L.order[j]] = [L.order[j], L.order[i]]; });
    const toggle = (id) => change((L) => { L.hidden = L.hidden.includes(id) ? L.hidden.filter((x) => x !== id) : [...L.hidden, id]; });
    const card = (id) => {
      const body = W[id].summary(c), title = h('h2', null, t(W_KEY[id]));
      if (editing) return h('div', { class: 'wcard editing', 'data-widget': id }, title, h('div', { class: 'wtools' },
        h('button', { type: 'button', class: 'round sm', 'aria-label': `${t('moveUp')}: ${t(W_KEY[id])}`, onclick: () => move(id, -1) }, icon('up', 20)), h('button', { type: 'button', class: 'round sm', 'aria-label': `${t('moveDown')}: ${t(W_KEY[id])}`, onclick: () => move(id, 1) }, icon('down', 20)),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => toggle(id) }, layout.hidden.includes(id) ? t('show') : t('hide'))));
      return h('a', { class: 'wcard', href: `#/d/${id}`, 'data-widget': id }, h('div', { class: 'whead' }, title, icon('forward', 18)), body);
    };
    const visible = editing ? layout.order : layout.order.filter((id) => !layout.hidden.includes(id));
    setChildren(el,
      h('div', { class: 'dash-top' }, h('h1', null, t('dashboard')), h('button', { type: 'button', class: 'btn ghost', 'aria-pressed': String(editing), onclick: () => { editing = !editing; draw(); } }, t(editing ? 'editDone' : 'edit'))),
      resume ? h('div', { class: 'card resume' }, icon(resume.kind, 28), h('span', { class: 'grow' }, h('b', null, t('resumeTitle')), h('small', null, fmtKm(resume.distanceM))), h('button', { type: 'button', class: 'btn ghost', onclick: () => { if (confirm(t('discardAsk'))) { active.clear(); draw(); } } }, t('discard')), h('a', { class: 'btn', href: `#/workout/${resume.kind}` }, t('resumeBtn'))) : null,
      quickActions(suggest(c.routes, c.all)[0]?.route || null),
      h('div', { class: 'starts' }, startLink('walk'), startLink('run')),
      welcome(c, draw),
      filterBar(c, draw), h('div', { class: 'wgrid' }, visible.map(card)),
      h('a', { class: 'link', href: '#/history' }, t('allWorkouts')));
  }
  draw(); el.cleanup = () => { el.alive = false; };
  return el;
}

/** Drill-down: the big version of a widget plus the workouts behind it, with the same filters. */
export function renderDrill(id) {
  if (!Object.hasOwn(W, id)) { location.hash = '#/'; return h('section'); }
  const el = h('section', { class: 'drill' }); let seq = 0;
  async function draw() {
    const mine = ++seq, c = await loadContext(); if (el.alive === false || mine !== seq) return;
    setChildren(el, h('a', { class: 'link back', href: '#/' }, icon('back', 20), t('dashboard')), h('h1', null, t(W_KEY[id])),
      ['effort', 'steps', 'alerts', 'reco', 'routes', 'plan'].includes(id) ? null : filterBar(c, draw), h('div', { class: 'detail' }, W[id].detail(c)),
      ['alerts', 'reco', 'routes', 'plan'].includes(id) ? null : h('h2', null, `${t('workouts')} · ${t('count', { n: c.rows.length })}`),
      ['alerts', 'reco', 'routes', 'plan'].includes(id) ? null : h('div', { class: 'list' }, c.rows.length ? c.rows.slice(0, 60).map(workoutRow) : none()));
  }
  draw(); el.cleanup = () => { el.alive = false; for (const b of el.querySelectorAll('.recobox')) b.alive = false; for (const b of el.querySelectorAll('.planbox')) b.alive = false; }; // also stops loads that are still running
  return el;
}
