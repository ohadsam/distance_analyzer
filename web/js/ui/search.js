// Global search: settings, screens, widgets, workouts and alerts in one box (Hebrew and English words both match).
import { h, setChildren } from '../util.js';
import { t, STR, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { buildIndex, search } from '../search.js';
import { listWorkouts, listRoutes, getPref } from '../store.js';
import { alertStore } from '../alerts.js';
import { fmtKm, fmtDate, workoutText } from '../format.js';
import { WIDGETS, W_KEY } from './dashboard.js';

const both = (k) => `${STR.en[k]} ${STR.he[k]}`;
// Settings and screens that can be found: [id, i18n key of the title, extra keywords (en + he), anchor].
const SETTINGS = [
  ['s-lang', 'language', 'hebrew english עברית אנגלית שפה', 'settings'], ['s-theme', 'theme', 'dark light night כהה בהיר מראה', 'settings'], ['s-pack', 'look', 'color colour pack theme צבע ערכת', 'settings'],
  ['s-age', 'age', 'profile גיל פרופיל', 'settings'], ['s-height', 'height', 'profile גובה סנטימטר cm', 'settings'], ['s-weight', 'weight', 'kg weight calories משקל קלוריות', 'settings'],
  ['s-breath', 'breath', 'rhythm metronome breathing נשימה מטרונום קצב', 'settings'], ['s-vol', 'volume', 'sound click metronome עוצמה צליל', 'settings'], ['s-bpm', 'defaultBpm', 'cadence steps rhythm קצב צעדים', 'settings'],
  ['s-online', 'setOnline', 'weather forecast online location מזג אוויר תחזית מיקום', 'settings'], ['s-reco-notify', 'setRecoNotify', 'recommendation notification good time המלצה התראה זמן טוב', 'settings'], ['s-plan-remind', 'planRemind', 'training plan reminder workout תוכנית תזכורת אימון', 'settings'], ['s-effort', 'effortAlerts', 'bar deviation alert סרגל מאמצים חריגה התראה', 'settings'], ['s-smart', 'remSmart', 'reminders nudge inactive תזכורות חכמות חוסר תנועה', 'settings'], ['s-rem', 'remTitle', 'reminder walk move תזכורת הליכה תנועה', 'settings'],
];
const SCREENS = [['', 'dashboard', 'home main בית ראשי'], ['history', 'history', 'workouts log אימונים יומן'], ['alerts', 'alertsTitle', 'notifications inbox התראות'], ['plan', 'planTitle', 'training plan program schedule goal 5k 10k תוכנית אימון לוח אימונים יעד'], ['routes', 'routesTitle', 'routes path track saved one-time מסלולים מסלול שמור חד פעמי'], ['reco', 'recoTitle', 'recommendations best time weather forecast המלצות זמן מועדף תחזית'], ['settings', 'settings', 'preferences הגדרות'], ['workout/run', 'startRun', 'record gps ריצה הקלטה'], ['workout/walk', 'startWalk', 'record gps הליכה הקלטה']];
const TYPE_KEY = { setting: 'typeSetting', screen: 'typeScreen', widget: 'typeWidget', workout: 'typeWorkout', alert: 'typeAlert', route: 'routeOf' };
const TYPE_ICON = { setting: 'settings', screen: 'home', widget: 'chart', workout: 'run', alert: 'bell', route: 'route' };

export async function buildItems() {
  const items = [];
  for (const [id, key, words] of SCREENS) items.push({ id: `screen:${id}`, type: 'screen', title: t(key), text: `${both(key)} ${words}`, href: `#/${id}` });
  for (const [id, key, words] of SETTINGS) items.push({ id: `set:${id}`, type: 'setting', title: t(key), text: `${both(key)} ${words}`, href: `#/settings/${id}` });
  for (const id of WIDGETS) items.push({ id: `w:${id}`, type: 'widget', title: t(W_KEY[id]), text: both(W_KEY[id]), href: `#/d/${id}` });
  for (const w of (await listWorkouts({ points: false })).slice(0, 400)) items.push({ id: `wk:${w.startedAt}`, type: 'workout', title: `${t(w.kind)} · ${fmtKm(w.distanceM)} · ${fmtDate(w.startedAt, getLang())}`, text: workoutText(w), href: `#/w/${w.startedAt}`, ts: w.startedAt });
  for (const r of await listRoutes()) items.push({ id: `rt:${r.id}`, type: 'route', title: `${r.name} · ${fmtKm(r.lengthM)}`, text: `${r.name} ${both('routesTitle')} ${r.oneTime ? both('routeOneTimeBadge') : ''}`, href: `#/r/${r.id}`, ts: r.createdAt });
  for (const a of alertStore.load()) items.push({ id: `al:${a.id}`, type: 'alert', title: t(a.title, a.params), text: `${both(a.title)} ${a.lines.map(both).join(' ')}`, href: '#/alerts', ts: a.ts });
  return items;
}

export function renderSearch() {
  const out = h('div', { class: 'list', 'aria-live': 'polite' }), el = h('section', { class: 'search' });
  const input = h('input', { type: 'search', id: 'q', class: 'q', placeholder: t('searchPh'), 'aria-label': t('search'), autocomplete: 'off', maxLength: 60 });
  let index = null;
  const go = () => {
    const res = index ? search(index, input.value, 30) : [];
    setChildren(out, !input.value.trim() ? h('p', { class: 'note' }, t('searchHint')) : res.length ? res.map((r) => h('a', { class: 'item result', href: r.href, 'data-type': r.type }, h('span', { class: 'kind' }, icon(TYPE_ICON[r.type], 22)), h('span', { class: 'grow' }, h('b', null, r.title), h('small', null, t(TYPE_KEY[r.type]))), icon('forward', 18))) : h('p', { class: 'note' }, t('searchNone')));
  };
  input.addEventListener('input', go);
  setChildren(el, h('h1', null, t('search')), h('div', { class: 'qbox' }, icon('search', 22), input), out); go();
  buildItems().then((items) => { if (el.alive === false) return; index = buildIndex(items); go(); });
  queueMicrotask(() => input.focus());
  el.cleanup = () => { el.alive = false; };
  return el;
}
