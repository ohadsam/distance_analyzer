// "What is new": a window once after an update (never on a first install, never over a workout) and a page you can open any time from Settings > About.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { CHANGES, changesFor } from '../changelog.js';
import { APP_VERSION } from '../appVersion.js';
import { getPref, setPref } from '../store.js';

const list = (c) => h('ul', null, c[getLang() === 'he' ? 'he' : 'en'].map((x) => h('li', null, x)));
export function openWhatsNew() {
  const now = changesFor(APP_VERSION) || CHANGES[0], older = CHANGES.filter((c) => c !== now);
  const dlg = h('dialog', { class: 'permsheet', id: 'wn-sheet', 'aria-labelledby': 'wn-title' });
  const close = () => { if (dlg.open) dlg.close(); dlg.remove(); };
  setChildren(dlg, h('h2', { id: 'wn-title' }, t('wnTitle', { v: now.v })), list(now),
    older.length ? h('details', null, h('summary', null, t('wnEarlier')), older.map((c) => h('section', null, h('h3', null, `v${c.v}`), list(c)))) : null,
    h('button', { type: 'button', class: 'btn', id: 'wn-close', autofocus: true, onclick: close }, t('shareClose')));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  document.body.append(dlg); dlg.showModal();
}
/** At start-up: show once per new version. Someone who already used the app (welcome card done) and has no record yet counts as updating; a brand-new install just records it. */
export function maybeShowWhatsNew() {
  if (/^#\/workout/.test(location.hash) || document.getElementById('perm-sheet')) return;
  const seen = getPref('seenVersion', ''); if (seen === APP_VERSION) return;
  setPref('seenVersion', APP_VERSION);
  if (seen || getPref('welcomed', '')) openWhatsNew();
}
