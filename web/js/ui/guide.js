// The user guide: a topic list and a step-by-step tour with pictures of the real app, a "Try it now" button for each step and keyboard arrows.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon, figure } from '../icons.js';
import { GUIDE, guideIndex, stepKeys } from '../guide.js';

const POSES = ['idle', 'ready', 'stretch', 'cooldown', 'wave']; // Trail's poses along the tour
const shotSrc = (id) => `art/guide/${getLang() === 'he' ? 'he' : 'en'}-${id}.jpg`;

export function renderGuide(id) {
  const i = id ? guideIndex(id) : -1;
  if (i < 0) return topics();
  return step(i);
}

function topics() {
  return h('section', { class: 'guide' }, h('h1', null, t('guideTitle')), figure('trail-wave', 96), h('p', null, t('guideIntro')),
    h('a', { class: 'btn', id: 'guide-start', href: `#/guide/${GUIDE[0].id}` }, icon('play', 20), t('guideStart')),
    h('ol', { class: 'topics' }, GUIDE.map((g, n) => h('li', null, h('a', { class: 'item', href: `#/guide/${g.id}`, 'data-topic': g.id }, h('span', { class: 'num' }, String(n + 1)), h('span', { class: 'grow' }, h('b', null, t(stepKeys(g.id)[0]))), icon('forward', 20))))));
}

function step(i) {
  const g = GUIDE[i], [tk, xk] = stepKeys(g.id), prev = GUIDE[i - 1], next = GUIDE[i + 1];
  const el = h('section', { class: 'guide step', 'data-step': g.id },
    h('p', { class: 'note', role: 'status' }, t('guideStepOf', { n: i + 1, total: GUIDE.length })),
    h('div', { class: 'dots', 'aria-hidden': 'true' }, GUIDE.map((x, n) => h('i', { class: n === i ? 'on' : n < i ? 'seen' : '' }))),
    h('h1', null, t(tk)),
    g.shot ? h('img', { class: 'gshot', src: shotSrc(g.id), alt: '', draggable: false, onerror: (e) => e.target.remove() }) : h('div', { class: 'gshot gicon' }, icon('settings', 64)),
    h('div', { class: 'gtalk' }, figure(`trail-${i === 0 ? 'wave' : !next ? 'cheer' : POSES[i % POSES.length]}`, 64), h('p', { class: 'gtext' }, t(xk))), // Trail talks you through it
    h('div', { class: 'row' }, h('a', { class: 'btn', id: 'guide-try', href: g.href }, t('guideTry'))),
    h('div', { class: 'gnav' }, prev ? h('a', { class: 'btn ghost', id: 'guide-prev', href: `#/guide/${prev.id}` }, icon(getLang() === 'he' ? 'forward' : 'back', 20), t('guidePrev')) : h('span'),
      h('a', { class: 'btn ghost', href: '#/guide' }, t('guideTopics')), next ? h('a', { class: 'btn', id: 'guide-next', href: `#/guide/${next.id}` }, t('guideNext'), icon(getLang() === 'he' ? 'back' : 'forward', 20)) : h('span')));
  // keyboard: the arrow that points "forward" follows the reading direction
  const onKey = (e) => { if (e.target.closest?.('input, select, textarea')) return; const rtl = getLang() === 'he', fwd = rtl ? 'ArrowLeft' : 'ArrowRight', back = rtl ? 'ArrowRight' : 'ArrowLeft'; if (e.key === fwd && next) location.hash = `#/guide/${next.id}`; else if (e.key === back && prev) location.hash = `#/guide/${prev.id}`; };
  addEventListener('keydown', onKey); el.cleanup = () => removeEventListener('keydown', onKey);
  return el;
}
