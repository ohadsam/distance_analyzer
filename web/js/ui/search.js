// Global search: settings, screens, widgets, workouts and alerts in one box (Hebrew and English words both match).
import { h, setChildren } from '../util.js';
import { t, STR, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { buildIndex, search } from '../search.js';
import { listWorkouts, listRoutes, getPref } from '../store.js';
import { alertStore } from '../alerts.js';
import { fmtKm, fmtDate, workoutText } from '../format.js';
import { WIDGETS, W_KEY } from './dashboard.js';
import { actionItems } from '../actions.js';
import { GUIDE, stepKeys } from '../guide.js';
import { buildFacts } from '../facts.js';
import { fmtPaceUnit, fmtClock } from '../format.js';
import { getNum } from '../store.js';

const both = (k) => `${STR.en[k]} ${STR.he[k]}`;
// Settings and screens that can be found: [id, i18n key of the title, extra keywords (en + he), anchor].
const SETTINGS = [
  ['s-lang', 'language', 'hebrew english עברית אנגלית שפה', 'settings'], ['s-theme', 'theme', 'dark light night כהה בהיר מראה', 'settings'], ['s-pack', 'look', 'color colour pack theme צבע ערכת', 'settings'], ['s-perms', 'setPerms', 'permissions allow location notifications steps activity battery background הרשאות מיקום התראות צעדים אישור', 'settings'], ['s-update', 'updSection', 'update check new version install download apk עדכון בדיקה גרסה התקנה הורדה', 'settings'], ['s-calm', 'setCalm', 'animation animations motion calm still reduce אנימציה אנימציות תנועה רגוע', 'settings'],
  ['s-age', 'age', 'profile גיל פרופיל', 'settings'], ['s-height', 'height', 'profile גובה סנטימטר cm', 'settings'], ['s-weight', 'weight', 'kg weight calories משקל קלוריות', 'settings'],
  ['s-breath', 'breath', 'rhythm metronome breathing נשימה מטרונום קצב', 'settings'], ['s-vol', 'volume', 'sound click metronome עוצמה צליל', 'settings'], ['s-bpm', 'defaultBpm', 'cadence steps rhythm קצב צעדים', 'settings'],
  ['s-online', 'setOnline', 'weather forecast online location מזג אוויר תחזית מיקום', 'settings'], ['s-reco-notify', 'setRecoNotify', 'recommendation notification good time המלצה התראה זמן טוב', 'settings'], ['s-plan-remind', 'planRemind', 'training plan reminder workout תוכנית תזכורת אימון', 'settings'], ['s-handsfree', 'setHandsFree', 'hands free double tap volume keys pause ידיים חופשיות הקשה כפולה', 'settings'], ['s-countdown', 'setCountdown', 'countdown start 3 2 1 ספירה לאחור', 'settings'], ['s-challenge', 'chSet', 'challenge goal weekly workouts per week אתגר שבועי יעד אימונים', 'settings'], ['s-weekly', 'setWeekly', 'weekly summary sunday notification סיכום שבועי התראה', 'settings'], ['s-tiles', 'setTiles', 'map street tiles openstreetmap background מפה רחובות רקע', 'settings'], ['s-voice', 'setVoice', 'voice speak speech audio tts הקראה קול דיבור', 'settings'], ['s-backup', 'bkTitle', 'backup restore export import data file save גיבוי שחזור נתונים קובץ ייצוא', 'settings'], ['s-about', 'aboutTitle', 'update updates version download apk share app עדכון עדכונים גרסה הורדה שיתוף אפליקציה', 'settings'], ['s-cues', 'setCues', 'live indications cues record distance ghost אינדיקציות שיא מרחק', 'settings'], ['s-effort', 'effortAlerts', 'bar deviation alert סרגל מאמצים חריגה התראה', 'settings'], ['s-smart', 'remSmart', 'reminders nudge inactive תזכורות חכמות חוסר תנועה', 'settings'], ['s-rem', 'remTitle', 'reminder walk move תזכורת הליכה תנועה', 'settings'],
];
const SCREENS = [['', 'dashboard', 'home main בית ראשי'], ['map', 'mapTitle', 'map measure distance מפה מדידה'], ['routeplan', 'planRouteTitle', 'plan route address תכנון מסלול כתובת'], ['history', 'history', 'workouts log אימונים יומן'], ['alerts', 'alertsTitle', 'notifications inbox התראות'], ['plan', 'planTitle', 'training plan program schedule goal 5k 10k תוכנית אימון לוח אימונים יעד'], ['routes', 'routesTitle', 'routes path track saved one-time מסלולים מסלול שמור חד פעמי'], ['reco', 'recoTitle', 'recommendations best time weather forecast המלצות זמן מועדף תחזית'], ['settings', 'settings', 'preferences הגדרות'], ['workout/run', 'startRun', 'record gps ריצה הקלטה'], ['workout/walk', 'startWalk', 'record gps הליכה הקלטה']];
const TYPE_KEY = { action: 'typeAction', guide: 'typeGuide', fact: 'typeFact', setting: 'typeSetting', screen: 'typeScreen', widget: 'typeWidget', workout: 'typeWorkout', alert: 'typeAlert', route: 'routeOf' };
const TYPE_ICON = { action: 'play', guide: 'help', fact: 'chart', setting: 'settings', screen: 'home', widget: 'chart', workout: 'run', alert: 'bell', route: 'route' };

export async function buildItems() {
  const items = [];
  for (const [id, key, words] of SCREENS) items.push({ id: `screen:${id}`, type: 'screen', title: t(key), text: `${both(key)} ${words}`, href: `#/${id}` });
  for (const [id, key, words] of SETTINGS) items.push({ id: `set:${id}`, type: 'setting', title: t(key), text: `${both(key)} ${words}`, href: `#/settings/${id}` });
  for (const id of WIDGETS) items.push({ id: `w:${id}`, type: 'widget', title: t(W_KEY[id]), text: both(W_KEY[id]), href: `#/d/${id}` });
  items.push(...actionItems(t, both));
  for (const g of GUIDE) { const [tk, xk] = stepKeys(g.id); items.push({ id: `guide:${g.id}`, type: 'guide', title: t(tk), text: `${both(tk)} ${both(xk)}`, href: `#/guide/${g.id}` }); }
  const rows = await listWorkouts({ points: false });
  items.push(...buildFacts(rows, Date.now(), { t, both, fmtKm, fmtDate, fmtPaceUnit, fmtClock, lang: getLang(), challengeN: getPref('challengeN', '3') }));
  for (const w of rows.slice(0, 400)) items.push({ id: `wk:${w.startedAt}`, type: 'workout', title: `${t(w.kind)} · ${fmtKm(w.distanceM)} · ${fmtDate(w.startedAt, getLang())}`, text: workoutText(w), href: `#/w/${w.startedAt}`, ts: w.startedAt });
  for (const r of await listRoutes()) items.push({ id: `rt:${r.id}`, type: 'route', title: `${r.name} · ${fmtKm(r.lengthM)}`, text: `${r.name} ${both('routesTitle')} ${r.oneTime ? both('routeOneTimeBadge') : ''}`, href: `#/r/${r.id}`, ts: r.createdAt });
  for (const a of alertStore.load()) items.push({ id: `al:${a.id}`, type: 'alert', title: t(a.title, a.params), text: `${both(a.title)} ${a.lines.map(both).join(' ')}`, href: '#/alerts', ts: a.ts });
  return items;
}

export function renderSearch() {
  const out = h('div', { class: 'list', 'aria-live': 'polite' }), el = h('section', { class: 'search' });
  const SUGGEST = ['searchQ1', 'searchQ2', 'searchQ3', 'searchQ4'];
  const input = h('input', { type: 'search', id: 'q', class: 'q', placeholder: t('searchPh'), 'aria-label': t('search'), autocomplete: 'off', maxLength: 60 });
  let index = null;
  const go = () => {
    const res = index ? search(index, input.value, 30) : [];
    setChildren(out, !input.value.trim() ? h('div', null, h('p', { class: 'note' }, t('searchHint')), h('div', { class: 'chips', role: 'group', 'aria-label': t('searchChips') }, SUGGEST.map((k) => h('button', { type: 'button', class: 'chip', onclick: () => { input.value = t(k); go(); input.focus(); } }, t(k)))), h('p', { class: 'note' }, t('searchEnter'))) : res.length ? res.map((r) => h('a', { class: 'item result', href: r.href, 'data-type': r.type }, h('span', { class: 'kind' }, icon(TYPE_ICON[r.type], 22)), h('span', { class: 'grow' }, h('b', null, r.title), h('small', null, t(TYPE_KEY[r.type]))), icon('forward', 18))) : h('p', { class: 'note' }, t('searchNone')));
  };
  input.addEventListener('input', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = out.querySelector('a.result'); if (first) location.hash = first.getAttribute('href'); } }); // Enter opens the first result
  setChildren(el, h('h1', null, t('search')), h('div', { class: 'qbox' }, icon('search', 22), input), out); go();
  buildItems().then((items) => { if (el.alive === false) return; index = buildIndex(items); go(); });
  queueMicrotask(() => input.focus());
  el.cleanup = () => { el.alive = false; };
  return el;
}
