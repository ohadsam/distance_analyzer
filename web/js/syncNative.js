// Keeps Android's notification schedule in step with the app (no-op in a browser): fixed reminders and, when enabled, the recommended walk times.
import { native } from './native.js';
import { t } from './i18n.js';
import { getJson, getPref, listWorkouts } from './store.js';
import { reminderEntries, recoEntries, planEntries, buildSchedule } from './schedule.js';
import { sanitizePlan, sessionDate } from './plan.js';
import { onlineOn, cachedForecast } from './weatherApi.js';
import { routineProfile, recommend } from './reco.js';
import { debounce } from './util.js';
import { widgetSnapshot } from './widgetData.js';
import { profile } from './store.js';
import { stepSeries, recommendedSteps } from './steps.js';
import { weekStatus } from './effort.js';
import { fmtKm, fmtPaceUnit, fmtClock, fmtDate } from './format.js';
import { paceSec } from './stats.js';
import { getLang } from './i18n.js';
import { planProgress } from './plan.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
/** Notifications for the planned sessions still ahead (when the person wants them): one at the chosen hour of each day. */
export function planReminders(from) {
  if (getPref('planRemind', '1') !== '1') return [];
  const plan = sanitizePlan(getJson('plan', null)); if (!plan) return [];
  return planEntries(plan, from, Number(getPref('planHour', '18')) || 18, (s) => ({ title: t('planRemindTitle'), body: t('planRemindBody', { what: t(`ty${cap(s.type)}`), min: s.minutes }) }), (s) => sessionDate(plan, s));
}

/** The newest workout as two short lines: distance, and time - pace - date. */
function lastText(rows) {
  const w = rows.reduce((a, b) => (!a || b.startedAt > a.startedAt ? b : a), null); if (!w) return null;
  const p = paceSec(w);
  return { value: fmtKm(w.distanceM), sub: [fmtClock(w.movingMs), p ? fmtPaceUnit(p) : '', fmtDate(w.startedAt, getLang())].filter(Boolean).join(' · ') };
}
/** The next planned training session (today or later), or null. */
function nextText(now) {
  const plan = sanitizePlan(getJson('plan', null)), s = plan && planProgress(plan, now).next; if (!s) return null;
  return { value: `${t(`ty${cap(s.type)}`)} ${s.minutes} ${t('min')}`, sub: fmtDate(sessionDate(plan, s), getLang()) };
}

async function sync() {
  if (!native.available) return;
  const now = Date.now(), rems = getJson('rems', []);
  const fixed = reminderEntries(rems, now, (kind) => ({ title: t(kind === 'walk' ? 'rem_walk' : 'rem_move'), body: t(kind === 'walk' ? 'rem_walk_body' : 'rem_move_body') }));
  let reco = [];
  if (getPref('recoNotify', '0') === '1' && onlineOn()) {
    const f = cachedForecast(now, 24 * 3600000), kind = getPref('recoKind', 'walk') === 'run' ? 'run' : 'walk';
    if (f?.length) reco = recoEntries(recommend(f, routineProfile(await listWorkouts({ points: false }), now, kind), kind, now, { tomorrow: true }).items, now, (i) => ({ title: t(`rec_notify_${kind}`), body: t('rec_notify_body', { range: `${String(i.start).padStart(2, '0')}:00-${String(i.end % 24).padStart(2, '0')}:00`, temp: i.params.temp }) }));
  }
  native.setNotifications(buildSchedule(fixed, reco, planReminders(now)));
  // home-screen widgets: the weekly effort, the steps goal and the quick-start activity
  const rows = await listWorkouts({ points: false }), prof = profile(), series = stepSeries(rows, 14, now, prof.heightCm, native.stepsDays());
  native.setWidgetData(widgetSnapshot({ goalSteps: recommendedSteps(series, prof.age), status: weekStatus(rows, prof.age, now, getJson('barOv', null)), kind: getPref('recoKind', 'walk'), last: lastText(rows), next: nextText(now) }, t));
}
/** Call whenever reminders, language or recommendation settings change (debounced). */
export const syncNative = debounce(() => { sync().catch(() => { /* a failed sync must never break the app */ }); }, 1500);
