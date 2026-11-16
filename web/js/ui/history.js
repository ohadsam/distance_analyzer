import { h, setChildren } from '../util.js';
import { workoutShareBox } from './workoutShare.js';
import { trackPicture } from './maptiles.js';
import { emptyState } from '../art.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { listWorkouts, deleteWorkout, updateWorkout } from '../store.js';
import { workoutRow } from './home.js';
import { fmtKm, fmtClock, fmtPaceUnit, fmtDate, workoutText } from '../format.js';
import { recordFlags } from '../records.js';
import { paceSec } from '../stats.js';
import { avgPaceSec, kcal } from '../workout.js';

import { summaryBox } from './routes.js';
import { getNum } from '../store.js';

export function renderHistory() {
  const list = h('div', { class: 'list' }), state = { q: '', sort: 'new', only: false }; let rows = [], flags = new Map();
  const sorters = { new: (a, b) => b.startedAt - a.startedAt, long: (a, b) => b.distanceM - a.distanceM, fast: (a, b) => (paceSec(a) || 9e9) - (paceSec(b) || 9e9) };
  const draw = () => {
    const q = state.q.trim().toLowerCase(), shown = rows.filter((r) => (!q || workoutText(r).toLowerCase().includes(q)) && (!state.only || flags.has(r.startedAt)) && (state.sort !== 'fast' || paceSec(r) > 0 && r.distanceM >= 1000)).sort(sorters[state.sort]);
    setChildren(list, shown.length ? shown.map((r) => workoutRow(r, flags.get(r.startedAt) || [])) : rows.length ? h('p', { class: 'note' }, t('drillNone')) : emptyState('no-workouts', t('noWorkouts')));
    chips();
  };
  const chipEls = [['new', 'histNewest'], ['long', 'histLongest'], ['fast', 'histFastest']].map(([k, key]) => h('button', { type: 'button', class: 'chip', 'data-sort': k, onclick: () => { state.sort = k; draw(); } }, t(key)));
  chipEls.push(h('button', { type: 'button', class: 'chip', 'data-sort': 'rec', onclick: () => { state.only = !state.only; draw(); } }, t('histRecords')));
  const bar = h('div', { class: 'chips', role: 'group', 'aria-label': t('history') }, chipEls);
  const chips = () => { for (const c of chipEls) c.setAttribute('aria-pressed', String(c.dataset.sort === 'rec' ? state.only : state.sort === c.dataset.sort)); }; // toggled in place: the focused chip stays
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  const input = h('input', { type: 'search', id: 'hist-q', maxLength: 40, 'aria-label': t('filterText'), placeholder: t('filterText'), oninput: (e) => { state.q = e.target.value; draw(); } });
  const mic = SR ? h('button', { type: 'button', class: 'btn ghost', id: 'hist-voice', onclick: () => { try { const r = new SR(); r.lang = getLang() === 'he' ? 'he-IL' : 'en-US'; r.onresult = (e) => { input.value = e.results[0][0].transcript.slice(0, 40); state.q = input.value; draw(); }; r.start(); } catch { /* not allowed */ } } }, t('histVoice')) : null;
  const el = h('section', null, h('h1', null, t('history')), h('div', { class: 'hist-tools' }, input, mic), bar, list);
  listWorkouts({ points: false }).then((all) => { if (el.alive === false) return; rows = all; flags = recordFlags(all); draw(); });
  chips(); el.cleanup = () => { el.alive = false; };
  return el;
}

export function renderDetail(id) {
  const box = h('section', null);
  box.cleanup = () => { box.alive = false; };
  listWorkouts().then((rows) => {
    if (box.alive === false) return; // the person already went elsewhere
    const r = rows.find((x) => x.startedAt === Number(id));
    if (!r) { location.hash = '#/history'; return; }
    const w = { ...r, kind: r.kind }, row = (k, v) => h('div', { class: 'row' }, h('span', null, k), h('b', null, v));
    setChildren(box, h('h1', null, `${t(r.kind)} · ${fmtDate(r.startedAt, getLang())}`), trackPicture(r.points),
      h('div', { class: 'rows' }, row(t('distance'), fmtKm(r.distanceM)), row(t('time'), fmtClock(r.elapsedMs || r.movingMs)), row(t('movingTime'), fmtClock(r.movingMs)), row(t('avgPace'), fmtPaceUnit(avgPaceSec(w))), row(t('kcal'), `${kcal(w, getNum('weight', 70, 30, 250))} ${t('kcalUnit')}`)),
      workoutShareBox(r), r.points.length >= 5 ? summaryBox(r) : null,
      weatherForm(r),
      r.splits.length ? h('h2', null, t('splits')) : null,
      h('div', { class: 'rows' }, r.splits.map((s, i) => row(t('splitKm', { n: s.km }), fmtClock(s.atMs - (i ? r.splits[i - 1].atMs : 0))))),
      h('button', { type: 'button', class: 'btn danger', onclick: async () => { if (confirm(t('confirmDelete'))) { await deleteWorkout(r.startedAt); location.hash = '#/history'; } } }, icon('trash', 20), t('deleteIt')));
  });
  return box;
}

/** Manual weather for a workout (automatic weather needs the internet and comes later). It feeds the weather widget and the filters. */
function weatherForm(r) {
  const cond = h('select', { id: 'wx-cond', 'aria-label': t('wxCond') }, [['clear', 'wxClear'], ['cloudy', 'wxCloudy'], ['rain', 'wxRain'], ['windy', 'wxWindy']].map(([v, k]) => h('option', { value: v, selected: (r.weather?.cond || 'clear') === v }, t(k))));
  const temp = h('input', { id: 'wx-temp', type: 'number', inputMode: 'numeric', min: -60, max: 60, step: 1, 'aria-label': t('wxTemp'), value: r.weather ? Math.round(r.weather.tempC) : '' });
  const msg = h('p', { class: 'note', role: 'status' });
  return h('div', { class: 'wxform' }, h('h2', null, t('wxTitle')), h('div', { class: 'wxrow' }, cond, temp, h('button', { type: 'button', class: 'btn', id: 'wx-save', onclick: async () => {
    if (temp.value === '') { msg.textContent = t('wxNeedTemp'); temp.focus(); return; }
    await updateWorkout(r.startedAt, { weather: { tempC: Number(temp.value), cond: cond.value } }); msg.textContent = t('wxSaved'); } }, t('wxSave'))), msg);
}
