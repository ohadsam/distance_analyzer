import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon, trackSvg } from '../icons.js';
import { listWorkouts, deleteWorkout } from '../store.js';
import { workoutRow } from './home.js';
import { fmtKm, fmtClock, fmtPaceUnit, fmtDate } from '../format.js';
import { avgPaceSec, kcal } from '../workout.js';
import { projectTrack } from '../geo.js';
import { getNum } from '../store.js';

export function renderHistory() {
  const list = h('div', { class: 'list' }), el = h('section', null, h('h1', null, t('history')), list);
  listWorkouts().then((rows) => { if (el.alive !== false) setChildren(list, rows.length ? rows.map(workoutRow) : h('p', { class: 'note' }, t('noWorkouts'))); });
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
      r.splits.length ? h('h2', null, t('splits')) : null,
      h('div', { class: 'rows' }, r.splits.map((s, i) => row(t('splitKm', { n: s.km }), fmtClock(s.atMs - (i ? r.splits[i - 1].atMs : 0))))),
      h('button', { type: 'button', class: 'btn danger', onclick: async () => { if (confirm(t('confirmDelete'))) { await deleteWorkout(r.startedAt); location.hash = '#/history'; } } }, icon('trash', 20), t('deleteIt')));
  });
  return box;
}
