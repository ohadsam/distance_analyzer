// Entry point: language/look, tiny hash router with per-view cleanup, service worker. UI modules live in js/ui/.
import { setLang, t } from './i18n.js';
import { getPref } from './store.js';
import { icon } from './icons.js';
import { renderHome } from './ui/home.js';
import { renderSettings, applyLook } from './ui/settings.js';
import { renderHistory, renderDetail } from './ui/history.js';
import { renderWorkout } from './ui/workout.js';
import { setChildren, h } from './util.js';

// route table: pattern -> view(param). Anything unknown falls back to Home.
const ROUTES = [[/^settings$/, renderSettings], [/^history$/, renderHistory], [/^w\/(\d{1,15})$/, renderDetail], [/^workout\/(walk|run)$/, renderWorkout], [/^$/, renderHome]];
let current = null;

function route() {
  current?.cleanup?.();
  const path = location.hash.replace(/^#\/?/, '');
  let view = renderHome, arg;
  for (const [re, fn] of ROUTES) { const m = re.exec(path); if (m) { view = fn; arg = m[1]; break; } }
  const workout = view === renderWorkout;
  document.body.dataset.view = workout ? 'workout' : 'page';
  current = view(arg);
  setChildren(document.getElementById('app'), current);
  setChildren(document.getElementById('topbar'), h('a', { href: '#/', class: 'brand' }, t('appName')),
    h('nav', { class: 'tabs', 'aria-label': t('appName') }, h('a', { href: '#/history', class: 'tab', 'aria-label': t('history') }, icon('history', 22)), h('a', { href: '#/settings', class: 'tab', 'aria-label': t('settings') }, icon('settings', 22))));
  document.title = t('appName'); document.getElementById('app').focus({ preventScroll: true });
}

setLang(getPref('lang', 'he'));
applyLook();
addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { /* offline-first is a bonus, never a blocker */ });
