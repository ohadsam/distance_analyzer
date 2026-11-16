// Part of the day and "today so far" (pure): the home screen leads with starting in the morning and afternoon, with the day's summary in the evening.
import { dayStart } from './stats.js';

/** 'morning' (5-12) | 'afternoon' (12-18) | 'evening' (18-22) | 'night' */
export function dayPart(now) { const h = new Date(now).getHours(); return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 18 ? 'afternoon' : h >= 18 && h < 22 ? 'evening' : 'night'; }

/** { n, km, minutes } of the workouts that started today. */
export function todaySummary(rows, now) {
  const ws = rows.filter((w) => dayStart(w.startedAt) === dayStart(now));
  return { n: ws.length, km: Math.round(ws.reduce((s, w) => s + w.distanceM, 0) / 100) / 10, minutes: Math.round(ws.reduce((s, w) => s + w.movingMs, 0) / 60000) };
}
/** Evening and night lead with the day's summary; so does any time once the person has already exercised today. */
export const leadsWithSummary = (part, today) => part === 'evening' || part === 'night' || today.n > 0;
