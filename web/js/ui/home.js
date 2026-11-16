import { h } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { fmtKm, fmtClock, fmtDate } from '../format.js';

/** One workout as a list row (used by the dashboard drill-down, history and search). */
export const workoutRow = (r, flags = []) => h('a', { class: 'item', href: `#/w/${r.startedAt}` },
  h('span', { class: `kind ${r.kind}` }, icon(r.kind)),
  h('span', { class: 'grow' }, h('b', null, fmtKm(r.distanceM), flags.length ? h('span', { class: 'tag rec', 'data-record': flags.join(' ') }, icon('trophy', 16), t('recordTag')) : null), h('small', null, `${fmtDate(r.startedAt, getLang())} · ${fmtClock(r.elapsedMs || r.movingMs)}`)),
  icon('forward', 20));
