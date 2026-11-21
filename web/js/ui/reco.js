// Recommendations: the best times to walk/run from the forecast + the person's routine, and recommendations from the effort bar, steps and streak.
// Screen (#/reco), dashboard widget summary and the shared body used by the drill-down. Logic lives in reco.js (pure); the network in weatherApi.js.
import { weatherBanner } from '../art.js';
import { skyNow, skySlot } from './skynow.js';
import { hourDetail, hourLine } from './hourdetail.js';
import { progressBar } from './progress.js';
import { weatherAt } from '../forecast.js';
import { h, setChildren } from '../util.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { listWorkouts, profile, getPref, setPref, getJson } from '../store.js';
import { onlineOn, getLoc, setLoc, locate, fetchForecast, cachedForecast } from '../weatherApi.js';
import { routineProfile, recommend, generalRecs } from '../reco.js';
import { weekStatus } from '../effort.js';
import { stepSeries, recommendedSteps } from '../steps.js';
import { streak, dayStart, DAY } from '../stats.js';
import { barChart } from '../charts.js';
import { native } from '../native.js';
import { listRoutes } from '../store.js';
import { suggest, suggestionCard } from './routes.js';

const AREAS = ['all', 'weather', 'routes', 'effort', 'routine'];
const AREA_KEY = { all: 'recoAll', weather: 'recoWeather', routes: 'routesTitle', effort: 'recoEffort', routine: 'recoRoutine' };
const hh = (n) => `${String(n % 24).padStart(2, '0')}:00`;
const range = (i) => `${hh(i.start)}-${hh(i.end)}`;
const TYPE_KEY = { habit: 'typeHabit', best: 'typeBest', avoid: 'typeAvoid' };

/** Sentence of reasons from keys, e.g. "pleasant temperature, dry, calm wind". */
const because = (i) => (i.type === 'avoid' ? i.bad : i.reasons).map((k) => t(i.type === 'avoid' ? `bad_${k}` : `why_${k}`, i.params)).join(', ');

/** Everything the screen needs. `pre` = the dashboard's already loaded context (rows, profile, steps, status): no second read. */
function build(rows, prof, now, series, status) {
  const kind = getPref('recoKind', 'walk') === 'run' ? 'run' : 'walk', d = new Date(now), last = Math.max(0, ...rows.map((w) => w.startedAt));
  return { rows, prof, kind, now, routine: routineProfile(rows, now, kind), general: generalRecs({ weekStatus: status, steps: { today: series[series.length - 1].quality, goal: recommendedSteps(series, prof.age) }, streak: streak(rows, now), daysSinceLast: last ? Math.floor((dayStart(now) - dayStart(last)) / DAY) : 0, hour: d.getHours(), weekday: d.getDay() }) };
}
async function context(now = Date.now()) {
  const rows = await listWorkouts({ points: false }), prof = profile();
  return build(rows, prof, now, stepSeries(rows, 14, now, prof.heightCm, native.stepsDays()), weekStatus(rows, prof.age, now, getJson('barOv', null)));
}
/** Sync summary for the dashboard widget: only the saved forecast, never the network. */
export function recoSummary(dash) {
  const c = build(dash.all, dash.prof, dash.now, dash.steps, dash.status), f = onlineOn() ? cachedForecast(c.now) : null;
  if (!f?.length) return h('p', { class: 'note' }, onlineOn() ? t('recoOpen') : t('recoWidgetNone'));
  const best = recommend(f, c.routine, c.kind, c.now).items.find((i) => i.type !== 'avoid' && i.day === 0);
  return h('div', null, best ? h('div', { class: 'stat' }, h('b', { class: 'big num' }, range(best)), h('small', null, `${t('recoBestToday')} · ${t(TYPE_KEY[best.type])} · ${because(best)}`)) : h('p', { class: 'note' }, t('recoNoneToday')), c.general[0] ? h('p', { class: 'note' }, t(c.general[0].title)) : null);
}

function card(i) {
  return h('article', { class: `reco ${i.type}`, 'data-reco': i.type }, h('div', { class: 'rhead' }, icon(i.type === 'avoid' ? 'cloud' : i.type === 'habit' ? 'clock' : 'sun', 22),
    h('b', { class: 'num' }, range(i)), h('span', { class: 'tag' }, t(TYPE_KEY[i.type])), i.day ? h('small', null, t('recoTomorrow')) : null), h('p', null, because(i) || t('recoNone')));
}
const generalCard = (r) => h('article', { class: 'reco', 'data-reco': r.area }, h('div', { class: 'rhead' }, icon(r.area === 'steps' ? 'steps' : r.area === 'routine' ? 'star' : 'target', 22), h('b', null, t(r.title))), h('p', null, t(r.body, r.params)), h('a', { class: 'btn ghost', href: r.href }, t('details')));

/** Fills `box` with the recommendations; `area` filters. Used by the screen and by the drill-down. */
export async function mountReco(box, area = 'all', { redraw } = {}) {
  const mine = box.seq = (box.seq || 0) + 1, c = await context(); if (box.alive === false || box.seq !== mine) return; // only the newest draw paints
  const day = Number(box.dataset.day || 0) ? 1 : 0, parts = [];
  const kindSel = h('select', { id: 'reco-kind', 'aria-label': t('recoKind'), onchange: (e) => { setPref('recoKind', e.target.value); redraw?.(); } }, [['walk', t('walk')], ['run', t('run')]].map(([v, l]) => h('option', { value: v, selected: v === c.kind }, l)));
  parts.push(h('div', { class: 'field' }, h('label', { for: 'reco-kind' }, t('recoKind')), kindSel));
  if (area === 'all' || area === 'weather') parts.push(...await weatherPart(c, day, box, redraw));
  if (area === 'all' || area === 'routes') { const sug = suggest(await listRoutes(), c.rows).slice(0, 3); if (sug.length || area === 'routes') parts.push(h('div', { class: 'rlist' }, h('h2', null, t('routeRecTitle')), sug.length ? sug.map(suggestionCard) : h('p', { class: 'note' }, t('routeRecNone')))); }
  if (area !== 'weather' && area !== 'routes') { const g = c.general.filter((r) => area === 'all' || r.area === area || (area === 'effort' && r.area === 'steps')); if (area !== 'all' || g.length) parts.push(h('div', { class: 'rlist' }, g.length ? g.map(generalCard) : (area === 'all' ? [] : [h('p', { class: 'note' }, t('recoNone'))]))); }
  if (box.alive !== false && box.seq === mine) setChildren(box, parts);
}

async function weatherPart(c, day, box, redraw) {
  if (!onlineOn() || !getLoc()) return [consentCard(redraw)];
  if (!box.hasChildNodes()) setChildren(box, progressBar(t('recoLoading')).el);
  const res = await fetchForecast({ force: !!box.dataset.retry }); delete box.dataset.retry;
  if (!res) return [h('div', { class: 'card' }, h('p', null, t('recoFail')), h('button', { type: 'button', class: 'btn', id: 'reco-retry', onclick: () => { box.dataset.retry = '1'; redraw?.(); } }, t('recoRetry')))];
  const r = recommend(res.list, c.routine, c.kind, c.now, { tomorrow: true }), items = r.items.filter((i) => i.day === day);
  const hours = r.hours.filter((x) => x.day === day && x.hour >= 6 && x.hour < 22);
  const mark = (hr) => { const it = items.find((i) => hr.hour >= i.start && hr.hour < i.end); return it?.type === 'avoid' ? 'bad' : it ? 'now' : ''; };
  const dayBtn = (d, k) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(day === d), onclick: () => { box.dataset.day = String(d); redraw?.(); } }, t(k));
  const good = items.filter((i) => i.type !== 'avoid'), bad = items.filter((i) => i.type === 'avoid');
  return [h('div', { class: 'chips', role: 'group' }, dayBtn(0, 'recoToday'), dayBtn(1, 'recoTomorrow')),
    hours.length ? hoursChart(hours, res.list, mark) : null,
    good.length ? h('div', { class: 'rlist' }, h('h2', null, t('recoGeneral')), good.map(card)) : h('p', { class: 'note' }, day ? t('recoNone') : t('recoNoWindow')),
    bad.length ? h('div', { class: 'rlist' }, bad.map(card)) : null,
    res.stale ? h('p', { class: 'note' }, t('recoStale')) : null, h('p', { class: 'note' }, t('recoAttr'))];
}

/** The comfort-by-hour bars: tap (or Tab + Enter) a bar to see that hour's weather - temperature, humidity, rain - right under the chart. */
function hoursChart(hours, list, mark) {
  const rows = hours.map((x) => list.find((z) => z.t === x.t)), holder = h('div', { class: 'wxholder', id: 'reco-hour' }), now = Date.now();
  const labels = hours.map((x, i) => (rows[i] ? hourLine(rows[i]) : `${x.hour}:00`));
  const show = (i) => { setChildren(holder, rows[i] ? hourDetail(rows[i]) : null); };
  const cur = Math.max(0, hours.findIndex((x) => now >= x.t && now < x.t + 3600000));
  const chart = barChart(hours.map((x) => ({ v: x.comfort, label: x.hour % 3 === 0 ? String(x.hour) : '', cls: mark(x) })), { h: 100, onPick: show, labels, title: t('recoTitle'), sel: cur });
  show(cur);
  return h('div', { class: 'recohours' }, chart, h('p', { class: 'note' }, t('wxChartHint')), holder);
}

function consentCard(redraw) {
  const msg = h('p', { class: 'err', role: 'status' });
  return h('div', { class: 'card consent' }, h('h2', null, t('recoConsentTitle')), h('p', null, t('recoConsentBody')), msg,
    h('button', { type: 'button', class: 'btn', id: 'reco-consent', onclick: async (e) => {
      e.target.disabled = true; msg.textContent = t('recoLocating');
      try { setLoc(await locate()); setPref('onlineWx', '1'); redraw?.(); } catch { msg.textContent = t('recoLocFail'); e.target.disabled = false; }
    } }, t('recoConsentBtn')), h('a', { class: 'btn ghost', href: '#/' }, t('recoNotNow')));
}

export function renderReco() {
  let area = 'all'; const box = h('div', { class: 'recobox' }), el = h('section', { class: 'recos' });
  const draw = () => { box.alive = true; mountReco(box, area, { redraw: draw }); chips(); };
  const bar = h('div', { class: 'chips', role: 'group', 'aria-label': t('recoTitle') });
  const chips = () => setChildren(bar, AREAS.map((a) => h('button', { type: 'button', class: 'chip', 'data-area': a, 'aria-pressed': String(a === area), onclick: () => { area = a; draw(); } }, t(AREA_KEY[a]))));
  const f = onlineOn() ? cachedForecast(Date.now()) : null, banner = f?.length ? skyNow(96) || weatherBanner(weatherAt(f, Date.now())) : onlineOn() ? skySlot(96) : null; // the animated sky when the forecast knows it, else the picture of the kit
  const hub = h('div', { class: 'card exhub', id: 'ex-hub' }, h('h2', null, t('exHubTitle')), h('p', { class: 'note' }, t('exHubText')),
    h('div', { class: 'maptools' }, h('a', { class: 'btn', id: 'ex-hub-warm', href: '#/exercises/warmup/run' }, t('exWarmLink')), h('a', { class: 'btn ghost', id: 'ex-hub-cool', href: '#/exercises/cooldown/run' }, t('exCoolLink'))));
  setChildren(el, h('h1', null, t('recoTitle')), banner, bar, box, hub); draw();
  el.cleanup = () => { box.alive = false; };
  return el;
}
