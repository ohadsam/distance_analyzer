import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { active, listWorkouts } from '../store.js';
import { fmtKm, fmtClock, fmtDate } from '../format.js';

export const workoutRow = (r) => h('a', { class: 'item', href: `#/w/${r.startedAt}` },
  h('span', { class: `kind ${r.kind}` }, icon(r.kind)),
  h('span', { class: 'grow' }, h('b', null, fmtKm(r.distanceM)), h('small', null, `${fmtDate(r.startedAt, getLang())} · ${fmtClock(r.movingMs)}`)),
  icon('forward', 20));

export function renderHome() {
  const list = h('div', { class: 'list', 'aria-label': t('recent') });
  const resume = active.load();
  const el = h('section', { class: 'home' }, h('h1', null, t('hello')), h('p', { class: 'note' }, t('helloHint')),
    resume ? h('a', { class: 'card resume', href: `#/workout/${resume.kind}` }, icon(resume.kind, 28), h('span', { class: 'grow' }, h('b', null, t('resumeTitle')), h('small', null, fmtKm(resume.distanceM))), h('span', { class: 'btn' }, t('resumeBtn'))) : null,
    h('div', { class: 'starts' },
      h('a', { class: 'start-card walk', href: '#/workout/walk' }, icon('walk', 40), h('b', null, t('startWalk'))),
      h('a', { class: 'start-card run', href: '#/workout/run' }, icon('run', 40), h('b', null, t('startRun')))),
    h('h2', null, t('recent')), list);
  listWorkouts().then((rows) => { setChildren(list, rows.length ? rows.slice(0, 3).map(workoutRow) : h('p', { class: 'note' }, t('noWorkouts')), rows.length > 3 ? h('a', { class: 'link', href: '#/history' }, t('allHistory')) : null); });
  return el;
}
