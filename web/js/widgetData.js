// Pure snapshot handed to the Android home-screen widgets: goals plus the texts already translated (Android has no translations of its own).
import { weekStart, dayStart, DAY } from './stats.js';
const short = (s, n = 40) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');
/** Effort minutes for each day of this week (Sunday first) and today's index: { mins: [7], today }. */
export function weekDays(rows, now, effortOf) {
  const start = weekStart(now), mins = Array(7).fill(0);
  for (const w of rows) { const d = Math.round((dayStart(w.startedAt) - start) / DAY); if (d >= 0 && d < 7) mins[d] += effortOf(w); }
  return { mins: mins.map((m) => Math.round(m)), today: Math.min(6, Math.max(0, Math.round((dayStart(now) - start) / DAY))) };
}
/** ctx: { goalSteps, status (effort.weekStatus), kind, last: {value, sub} | null, next: {value, sub} | null, week: {mins, today, labels} | null }; t: translator. Numbers are rounded, texts short. */
export function widgetSnapshot({ goalSteps, status, kind, last = null, next = null, week = null }, t) {
  const done = Math.round(status.done), plan = Math.round(status.plan.minutes);
  return { stepsGoal: Math.max(0, Math.round(goalSteps)), effortDone: done, effortPlan: plan, kind: kind === 'run' ? 'run' : 'walk',
    stepsTitle: t('wSteps'), effortTitle: t('wEffort'), effortSub: t(status.status === 'ahead' ? 'effAhead' : status.status === 'on' ? 'effOn' : 'effBehind'),
    quickTitle: t('qaMeasure'), quickHint: t(kind === 'run' ? 'run' : 'walk'),
    lastTitle: t('wLast'), lastValue: short(last?.value) || '–', lastSub: short(last?.sub, 60) || t('wLastNone'),
    nextTitle: t('wNext'), nextValue: short(next?.value) || '–', nextSub: short(next?.sub, 60) || t('wNextNone'),
    weekTitle: t('wWeekBars'), weekMin: Array.isArray(week?.mins) && week.mins.length === 7 ? week.mins.map((m) => Math.max(0, Math.min(1000, Math.round(Number(m) || 0)))) : Array(7).fill(0),
    weekToday: Math.max(0, Math.min(6, Math.round(Number(week?.today) || 0))), weekLabels: Array.isArray(week?.labels) && week.labels.length === 7 ? week.labels.map((l) => short(String(l), 3)) : ['', '', '', '', '', '', ''] };
}
