// The points marked during a workout: a table with the totals at each point (distance, time, pace) and the stretch since the previous point. Used by the summary and the workout detail.
import { h } from '../util.js';
import { t } from '../i18n.js';
import { markRows } from '../workout.js';
import { fmtKm, fmtClock, fmtPaceUnit } from '../format.js';

/** A <section> with the table, or null when nothing was marked. */
export function marksTable(marks) {
  if (!marks?.length) return null;
  const rows = markRows(marks), pace = (s) => (s > 0 ? fmtPaceUnit(s) : '–');
  return h('section', { class: 'marks', id: 'marks-table' }, h('h2', null, t('marksTitle')),
    h('div', { class: 'tablewrap' }, h('table', { class: 'marktable' }, h('caption', { class: 'sr-only' }, t('marksTitle')),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, t('marksPoint')), h('th', { scope: 'col' }, t('distance')), h('th', { scope: 'col' }, t('time')), h('th', { scope: 'col' }, t('pace')), h('th', { scope: 'col' }, t('marksSince')))),
      h('tbody', null, rows.map((r) => h('tr', { 'data-mark': r.n }, h('th', { scope: 'row' }, h('span', { class: 'markbadge' }, String(r.n))), h('td', null, fmtKm(r.distM)), h('td', null, fmtClock(r.elapsedMs)), h('td', null, pace(r.paceSec)), h('td', null, `${fmtKm(r.segM)} · ${pace(r.segPaceSec)}`))))))); 
}
