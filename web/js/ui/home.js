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
  const startLink = (kind, label) => h('a', { class: `start-card ${kind}`, href: `#/workout/${kind}`, onclick: (e) => { if (!resume) return; if (confirm(t('replaceAsk'))) active.clear(); else e.preventDefault(); } }, icon(kind, 40), h('b', null, label));
  const el = h('section', { class: 'home' }, h('h1', null, t('hello')), h('p', { class: 'note' }, t('helloHint')),
    resume ? h('div', { class: 'card resume' }, icon(resume.kind, 28), h('span', { class: 'grow' }, h('b', null, t('resumeTitle')), h('small', null, fmtKm(resume.distanceM))),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { if (confirm(t('discardAsk'))) { active.clear(); location.reload(); } } }, t('discard')), h('a', { class: 'btn', href: `#/workout/${resume.kind}` }, t('resumeBtn'))) : null,
    h('div', { class: 'starts' }, startLink('walk', t('startWalk')), startLink('run', t('startRun'))),
    h('h2', null, t('recent')), list);
  listWorkouts().then((rows) => { if (el.alive === false) return; setChildren(list, rows.length ? rows.slice(0, 3).map(workoutRow) : h('p', { class: 'note' }, t('noWorkouts')), rows.length > 3 ? h('a', { class: 'link', href: '#/history' }, t('allHistory')) : null); });
  el.cleanup = () => { el.alive = false; };
  return el;
}
