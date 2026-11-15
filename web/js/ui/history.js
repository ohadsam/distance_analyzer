import { h, setChildren } from '../util.js';
import { emptyState } from '../art.js';
import { t, getLang } from '../i18n.js';
import { icon, trackSvg } from '../icons.js';
import { listWorkouts, deleteWorkout, updateWorkout } from '../store.js';
import { workoutRow } from './home.js';
import { fmtKm, fmtClock, fmtPaceUnit, fmtDate } from '../format.js';
import { avgPaceSec, kcal } from '../workout.js';
import { projectTrack } from '../geo.js';
import { summaryBox } from './routes.js';
import { getNum } from '../store.js';

export function renderHistory() {
  const list = h('div', { class: 'list' }), el = h('section', null, h('h1', null, t('history')), list);
  listWorkouts().then((rows) => { if (el.alive !== false) setChildren(list, rows.length ? rows.map(workoutRow) : emptyState('no-workouts', t('noWorkouts'))); });
  el.cleanup = () => { el.alive = false; };
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
    setChildren(box, h('h1', null, `${t(r.kind)} · ${fmtDate(r.startedAt, getLang())}`), trackSvg(projectTrack(r.points, 300, 180)),
      h('div', { class: 'rows' }, row(t('distance'), fmtKm(r.distanceM)), row(t('time'), fmtClock(r.elapsedMs || r.movingMs)), row(t('movingTime'), fmtClock(r.movingMs)), row(t('avgPace'), fmtPaceUnit(avgPaceSec(w))), row(t('kcal'), `${kcal(w, getNum('weight', 70, 30, 250))} ${t('kcalUnit')}`)),
      r.points.length >= 5 ? summaryBox(r) : null,
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
