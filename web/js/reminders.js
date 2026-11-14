// Pure reminder logic: fixed reminders (walks, movement breaks at set times) and the smart nudge (a gentle prompt when there was no movement
// for a long time, at a sensible hour). No DOM, no storage, no clock: `now` and the state are passed in.
import { clamp, cleanText } from './util.js';

export const KINDS = ['walk', 'move'];
export const SMART_DEFAULT = { on: false, fromHour: 8, toHour: 21, afterMin: 90, maxPerDay: 3, gapMin: 120 };
export const MAX_REMINDERS = 12;

const hm = (s) => { const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(s)); return m ? +m[1] * 60 + +m[2] : -1; };

/** Untrusted reminder list -> a safe one. */
export function sanitizeReminders(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_REMINDERS).map((r, i) => (r && typeof r === 'object' && hm(r.time) >= 0 ? {
    id: cleanText(r.id, 20) || `r${i}`, kind: KINDS.includes(r.kind) ? r.kind : 'walk', time: `${String(Math.floor(hm(r.time) / 60)).padStart(2, '0')}:${String(hm(r.time) % 60).padStart(2, '0')}`,
    days: Array.isArray(r.days) ? [...new Set(r.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [0, 1, 2, 3, 4, 5, 6], on: r.on !== false } : null)).filter(Boolean);
}
export function sanitizeSmart(s) {
  const o = { ...SMART_DEFAULT, ...(s && typeof s === 'object' ? s : {}) };
  // the smart window lies within one day: its end is after its start
  const from = clamp(+o.fromHour | 0, 0, 23), to = clamp(+o.toHour | 0, 1, 24);
  return { on: o.on === true, fromHour: from, toHour: to > from ? to : Math.min(24, from + 1), afterMin: clamp(+o.afterMin | 0, 30, 480), maxPerDay: clamp(+o.maxPerDay | 0, 1, 8), gapMin: clamp(+o.gapMin | 0, 30, 480) };
}

/** Fixed reminders that fall due in the window (lastCheck, now] - call about once a minute. Returns the due reminders. */
export function dueReminders(list, lastCheck, now) {
  const out = [];
  for (const r of list) {
    if (!r.on) continue;
    const m = hm(r.time), d = new Date(now);
    for (const back of [0, 1]) { // the window may straddle midnight
      const day = new Date(d); day.setDate(d.getDate() - back); day.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (r.days.includes(day.getDay()) && day.getTime() > lastCheck && day.getTime() <= now) out.push(r);
    }
  }
  return out;
}

/**
 * The smart nudge. ctx = { lastMoveAt (ms, 0 = none today), nudgesToday, lastNudgeAt, stepsToday, goalSteps, weekBehind (bool), activeNow (bool: a workout is running) }.
 * Returns null (stay quiet) or { kind: 'walk'|'move', why: 'idle'|'behind' } - the UI words it. Quiet outside the person's waking hours,
 * while a workout runs, after the goal is met, and never more than `maxPerDay` times or closer than `gapMin` apart.
 */
export function smartNudge(smart, ctx, now) {
  if (!smart.on || ctx.activeNow) return null;
  const d = new Date(now), hour = d.getHours() + d.getMinutes() / 60;
  if (hour < smart.fromHour || hour >= smart.toHour) return null;
  if (ctx.nudgesToday >= smart.maxPerDay || (ctx.lastNudgeAt && now - ctx.lastNudgeAt < smart.gapMin * 60000)) return null;
  if (ctx.goalSteps > 0 && ctx.stepsToday >= ctx.goalSteps) return null;
  const sinceMove = ctx.lastMoveAt ? now - ctx.lastMoveAt : now - new Date(d).setHours(smart.fromHour, 0, 0, 0);
  if (sinceMove < smart.afterMin * 60000) return null;
  // late in the day with the week behind: a proper walk; otherwise a short movement break
  const late = hour >= 16 && hour < smart.toHour - 1;
  return { kind: ctx.weekBehind && late ? 'walk' : 'move', why: ctx.weekBehind && late ? 'behind' : 'idle' };
}
