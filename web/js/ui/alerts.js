// The alerts inbox: effort alerts (what happened / why it matters / what to do / a gentle new bar) and reminders.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { alertStore, markAllRead } from '../alerts.js';
import { setJson } from '../store.js';
import { weekStart } from '../stats.js';

/** One alert as a card. Text comes from i18n keys + params, so it follows the language. */
export function alertCard(a, { onChange = () => {} } = {}) {
  const when = new Date(a.ts).toLocaleString(getLang() === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  const sect = (cap, key) => (key ? h('div', { class: 'asec' }, h('b', null, cap), h('p', null, t(key, a.params))) : null);
  const [what, risk, tip] = a.lines;
  return h('article', { class: `alert ${a.level} ${a.read ? '' : 'unread'}`, 'data-alert': a.id }, h('div', { class: 'ahead' }, icon(a.kind === 'effort' ? 'activity' : 'bell', 22), h('b', { class: 'grow' }, t(a.title, a.params)), h('small', null, when)),
    a.kind === 'effort' ? [sect(t('why'), what), sect(t('risk'), risk), sect(t('tip'), tip)] : (what ? h('p', null, t(what, a.params)) : null),
    a.params.newTarget > a.params.plan && !a.params.applied ? h('div', { class: 'asec' }, h('p', null, t('eff_plan', a.params)),
      h('button', { type: 'button', class: 'btn', onclick: () => { setJson('barOv', { week: weekStart(a.ts), minutes: Number(a.params.newTarget) }); alertStore.save(alertStore.load().map((x) => (x.id === a.id ? { ...x, params: { ...x.params, applied: 1 } } : x))); onChange(); announce(t('barApplied', { n: a.params.newTarget })); } }, t('applyBar', { n: a.params.newTarget })))
      : a.params.applied ? h('p', { class: 'note' }, t('barApplied', { n: a.params.newTarget })) : null);
}
const announce = (msg) => { const sr = document.getElementById('sr'); if (sr) sr.textContent = msg; };

export function renderAlerts() {
  const el = h('section', { class: 'alerts' });
  function draw() {
    const list = alertStore.load();
    setChildren(el, h('h1', null, t('alertsTitle')),
      list.length ? h('div', { class: 'row-actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => { alertStore.save(markAllRead(list)); dispatchEvent(new CustomEvent('stepup-alerts')); draw(); } }, t('markRead')),
        h('button', { type: 'button', class: 'btn danger', onclick: () => { alertStore.save([]); dispatchEvent(new CustomEvent('stepup-alerts')); draw(); } }, t('clearAll'))) : null,
      list.length ? h('div', { class: 'list' }, list.map((a) => alertCard(a, { onChange: draw }))) : h('p', { class: 'note' }, t('alertsEmpty')));
  }
  draw(); // opening the inbox marks everything as read after a moment, so the unread dot disappears without hiding what is new on screen
  el.cleanup = () => { alertStore.save(markAllRead(alertStore.load())); dispatchEvent(new CustomEvent('stepup-alerts')); };
  return el;
}
