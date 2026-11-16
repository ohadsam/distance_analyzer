// Entry point: language/look, tiny hash router with per-view cleanup, service worker. UI modules live in js/ui/.
import { setLang, t } from './i18n.js';
import { getPref } from './store.js';
import { icon } from './icons.js';
import { brandMark, brandWordmark } from './brand.js';
import { renderDashboard, renderDrill } from './ui/dashboard.js';
import { renderAlerts } from './ui/alerts.js';
import { renderSearch } from './ui/search.js';
import { renderGuide } from './ui/guide.js';
import { renderMap } from './ui/mapScreen.js';
import { renderRoutePlan } from './ui/planner.js';
import { renderReco } from './ui/reco.js';
import { renderRoutes, renderRoute } from './ui/routes.js';
import { renderPlan } from './ui/plan.js';
import { alertStore, unreadCount } from './alerts.js';
import { startReminderLoop } from './reminderLoop.js';
import { native, onNativeEvent } from './native.js';
import { syncNative } from './syncNative.js';
import { renderSettings, applyLook } from './ui/settings.js';
import { renderHistory, renderDetail } from './ui/history.js';
import { renderWorkout } from './ui/workout.js';
import { setChildren, h } from './util.js';

// route table: pattern -> view(param). Anything unknown falls back to Home.
const ROUTES = [[/^settings(?:\/([\w-]{1,30}))?$/, renderSettings], [/^history$/, renderHistory], [/^w\/(\d{1,15})$/, renderDetail], [/^workout\/(walk|run)(?:\/(go))?(?:\/r\/(r[a-z0-9]{3,24}))?$/, renderWorkout], [/^routes$/, renderRoutes], [/^map$/, renderMap], [/^routeplan$/, renderRoutePlan], [/^plan$/, renderPlan], [/^r\/(r[a-z0-9]{3,24})$/, renderRoute], [/^d\/([a-z]{3,20})$/, renderDrill], [/^alerts$/, renderAlerts], [/^search$/, renderSearch], [/^guide(?:\/([a-z]{3,20}))?$/, renderGuide], [/^reco$/, renderReco], [/^$/, renderDashboard]];
let current = null;

function route() {
  current?.cleanup?.();
  const path = location.hash.replace(/^#\/?/, '');
  let view = renderDashboard, args = [];
  for (const [re, fn] of ROUTES) { const m = re.exec(path); if (m) { view = fn; args = m.slice(1); break; } }
  const workout = view === renderWorkout;
  document.body.dataset.view = workout ? 'workout' : 'page';
  current = view(...args);
  setChildren(document.getElementById('app'), current);
  setChildren(document.getElementById('topbar'), h('a', { href: '#/', class: 'brand', 'aria-label': t('appName') }, brandMark(30), brandWordmark(20)),
    h('nav', { class: 'tabs', 'aria-label': t('settings') }, h('a', { href: '#/search', class: 'tab', 'aria-label': t('search') }, icon('search', 22)),
      h('a', { href: '#/alerts', class: 'tab', id: 'tab-alerts', 'aria-label': t('alertsTitle') }, icon('bell', 22), h('i', { class: 'dot', hidden: !unreadCount(alertStore.load()) })), h('a', { href: '#/settings', class: 'tab', 'aria-label': t('settings') }, icon('settings', 22))));
  // bottom navigation: the four places people go most (hidden in workout mode, where the screen is for the workout)
  const at = (re) => re.test(path);
  const items = [['#/', 'home', t('home'), path === '' || /^d\//.test(path)], ['#/routes', 'route', t('routesTitle'), at(/^(routes|r\/)/)], ['#/plan', 'calendar', t('planTitle'), at(/^plan/)], ['#/reco', 'star', t('recoTitle'), at(/^reco/)]];
  document.getElementById('bottomnav').setAttribute('aria-label', t('menu'));
  setChildren(document.getElementById('bottomnav'), ...items.map(([href, ic, label, on]) => h('a', { href, class: 'bn', 'aria-label': label, 'aria-current': on ? 'page' : null }, icon(ic, 24), h('span', null, label))));
  document.title = t('appName'); document.getElementById('app').focus({ preventScroll: true });
}

setLang(getPref('lang', 'he'));
applyLook();
addEventListener('hashchange', route);
addEventListener('stepup-alerts', () => { const d = document.querySelector('#tab-alerts .dot'); if (d) d.hidden = !unreadCount(alertStore.load()); });
startReminderLoop();
// Android: a tapped notification asks for a screen; the step sensor is sampled when the app is in front; the notification schedule is refreshed.
function onFront() {
  const href = native.takePendingHref(); if (href && location.hash !== href) location.hash = href;
  if (native.stepsAvailable()) native.stepsSample();
  syncNative();
}
if (native.available) { onFront(); onNativeEvent((e) => { if (e?.type === 'href') onFront(); }); document.addEventListener('visibilitychange', () => { if (document.hidden) syncNative(); else onFront(); }); setInterval(() => { if (!document.hidden && native.stepsAvailable()) native.stepsSample(); }, 60000); }
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { /* offline-first is a bonus, never a blocker */ });
