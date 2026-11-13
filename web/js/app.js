// Entry point: language/theme, tiny hash router, registers the service worker. UI modules live in js/ui/.
import { setLang, t } from './i18n.js';
import { renderHome } from './ui/home.js';
import { renderSettings } from './ui/settings.js';
import { setChildren, h } from './util.js';

const ROUTES = { '': renderHome, settings: renderSettings };

export function getPref(key, fallback) { try { return localStorage.getItem(`da.${key}`) || fallback; } catch { return fallback; } }
export function setPref(key, value) { try { localStorage.setItem(`da.${key}`, value); } catch { /* storage blocked: stays in memory only */ } }

function route() {
  const name = location.hash.replace(/^#\/?/, '');
  const view = ROUTES[name] || renderHome;
  const main = document.getElementById('app');
  setChildren(main, view());
  setChildren(document.getElementById('topbar'), h('a', { href: '#/', class: 'brand' }, t('appName')), h('a', { href: '#/settings', class: 'btn' }, t('settings')));
  document.title = t('appName');
}

setLang(getPref('lang', 'he'));
addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { /* offline-first is a bonus, never a blocker */ });
