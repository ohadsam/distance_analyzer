// The guided warm-up (before a run or walk) and cool-down / stretches (after): a list of exercises with the character, how to do each, and a guided session that counts the seconds of each.
import { h, setChildren } from '../util.js';
import { t } from '../i18n.js';
import { getPref, setPref } from '../store.js';
import { speak } from '../voice.js';
import { getLang } from '../i18n.js';
import { pose } from './character.js';
import { sessionOf, totalSeconds, isExercise } from '../exercises.js';
import { ANIMATED, EXERCISE_ANIM } from '../exerciseData.js';
import { progressBar } from './progress.js';

/** The picture of an exercise: the looping animation when it exists, else the character's stretch pose. */
export function exerciseFigure(id, size = 120) {
  if (!ANIMATED.includes(id)) return pose('stretch', size);
  return h('span', { class: 'wxa anim-on', 'data-ex': id, 'aria-hidden': 'true', style: { 'inline-size': `${size}px`, 'block-size': `${size}px`, '--ms': `${EXERCISE_ANIM.ms}ms`, '--n': String(EXERCISE_ANIM.frames) } },
    h('img', { src: `art/exercises/${id}.webp`, alt: '', draggable: false, width: EXERCISE_ANIM.size * EXERCISE_ANIM.frames, height: EXERCISE_ANIM.size }));
}
const secText = (s) => (s >= 90 ? t('exTotal', { min: Math.round(s / 60) }) : t('exSeconds', { s }));

export function renderExercises(which = 'warmup', kind = 'run') {
  const session = which === 'cooldown' ? 'cooldown' : 'warmup', k = kind === 'walk' ? 'walk' : 'run', walkMin = Math.max(2, Math.min(20, Number(getPref('coolWalkMin', '5')) || 5));
  const plan = sessionOf(session, k, { walkMin }), el = h('section', { class: 'exercises', 'data-session': session }); let timer = 0, idx = 0, left = 0, paused = false;
  const stop = () => { clearInterval(timer); timer = 0; };
  const kindLinks = h('div', { class: 'chips', role: 'group' }, ['run', 'walk'].map((x) => h('a', { class: 'chip', href: `#/exercises/${session}/${x}`, 'aria-current': x === k ? 'page' : null }, t(x === 'run' ? 'exKindRun' : 'exKindWalk'))));
  function list() {
    stop();
    setChildren(el, h('h1', null, t(session === 'warmup' ? 'exTitleWarmup' : 'exTitleCooldown')), h('p', { class: 'note' }, t(session === 'warmup' ? 'exIntroWarmup' : 'exIntroCooldown')), kindLinks,
      h('p', { class: 'note', id: 'ex-total' }, `${t('exTotal', { min: Math.max(1, Math.round(totalSeconds(plan) / 60)) })} · ${plan.length}`),
      h('button', { type: 'button', class: 'btn', id: 'ex-start', onclick: () => { idx = 0; guided(); } }, t('exStart')),
      h('ol', { class: 'exlist' }, plan.map((e, i) => h('li', { class: 'card exitem', 'data-ex': e.id }, exerciseFigure(e.id, 96), h('div', null, h('b', null, `${i + 1}. ${t(`ex_${e.id}`)}`), h('small', null, secText(e.seconds)), h('p', { class: 'note' }, t(`exh_${e.id}`)))))),
      ANIMATED.length ? null : h('p', { class: 'note' }, t('exPictureNote')));
  }
  function guided() {
    stop(); paused = false; const e = plan[idx]; if (!e) return done(); left = e.seconds;
    const bar = progressBar(t('exOf', { n: idx + 1, total: plan.length })), count = h('b', { class: 'excount', id: 'ex-count', 'aria-live': 'off' }, String(left)), pbtn = h('button', { type: 'button', class: 'btn ghost', id: 'ex-pause', onclick: () => { paused = !paused; pbtn.textContent = t(paused ? 'exResume' : 'exPause'); } }, t('exPause'));
    bar.set(idx, plan.length); if (getPref('voice', '0') === '1') speak(t(`ex_${e.id}`), getLang());
    setChildren(el, h('h1', null, t(session === 'warmup' ? 'exTitleWarmup' : 'exTitleCooldown')), bar.el, h('div', { class: 'exnow card', id: 'ex-now', 'data-ex': e.id }, exerciseFigure(e.id, 200), h('h2', null, t(`ex_${e.id}`)), h('p', null, t(`exh_${e.id}`)), count),
      h('div', { class: 'maptools' }, h('button', { type: 'button', class: 'btn ghost', id: 'ex-prev', disabled: idx === 0, onclick: () => { idx--; guided(); } }, t('exPrev')), pbtn, h('button', { type: 'button', class: 'btn', id: 'ex-next', onclick: () => { idx++; guided(); } }, t('exNext'))),
      h('button', { type: 'button', class: 'linkbtn', id: 'ex-list', onclick: list }, t('exBack')));
    timer = setInterval(() => { if (paused) return; left--; count.textContent = String(Math.max(0, left)); if (left <= 0) { idx++; guided(); } }, 1000);
  }
  function done() { stop(); setChildren(el, h('h1', null, t('exDone')), h('div', { class: 'card', id: 'ex-done' }, exerciseFigure('cd_breathing', 160), h('p', null, t('exDoneText'))), h('a', { class: 'btn', href: '#/' }, t('done')), h('button', { type: 'button', class: 'btn ghost', onclick: list }, t('exBack'))); }
  list(); el.cleanup = stop; return el;
}
export { isExercise };
