// Pure training-plan engine: builds a weekly plan from age, level, goal, sessions per week and the chosen workout types; matches finished
// workouts to planned sessions; proposes how to catch up on missed ones; adapts gently after a week with misses. General guidance, not medical
// advice. No DOM, no storage, no clock (dates are local-midnight timestamps computed from the plan's start). Text comes from i18n keys.
import { clamp, cleanText } from './util.js';
import { guideFor, weeklyEffort } from './effort.js';
import { median } from './util.js';
import { dayStart, DAY } from './stats.js';

export const GOALS = ['general', '5k', '10k', 'weight'], TYPES = ['easy', 'long', 'intervals', 'tempo', 'strength'], LEVELS = ['beginner', 'regular', 'advanced'];
export const MIN_WEEKS = 4, MAX_WEEKS = 12, MIN_SESSIONS = 2, MAX_SESSIONS = 6, HARD = new Set(['long', 'intervals', 'tempo']);
const WEIGHT = { long: 1.5, tempo: 1, intervals: 1, easy: 0.8 }; // share of the week's effort per session type
const DEFAULT_DAYS = { 2: [1, 4], 3: [0, 2, 4], 4: [0, 2, 4, 6], 5: [0, 1, 3, 4, 6], 6: [0, 1, 2, 4, 5, 6] };

/** Beginner when the last weeks were light, advanced when they were heavy. */
export function levelFromHistory(rows, now) {
  const w = weeklyEffort(rows, now, 4).map((x) => x.min), m = median(w.filter((x) => x > 0));
  return !m || m < 60 ? 'beginner' : m < 180 ? 'regular' : 'advanced';
}
const rate = (age) => (age >= 65 ? 0.06 : age < 18 ? 0.08 : 0.10); // weekly growth of the effort

/** Run/walk structure for an interval session: { reps, workSec, restSec }. */
export function intervalStructure(level, week, minutes, kind) {
  const table = level === 'beginner' ? [[60, 120], [90, 120], [120, 90], [180, 90], [240, 60], [300, 60]] : level === 'regular' ? [[120, 90], [180, 90], [240, 90], [300, 90], [360, 90]] : [[180, 90], [240, 90], [300, 90], [360, 60], [480, 90]];
  const [workSec, restSec] = table[Math.min(table.length - 1, Math.floor(week / 2))];
  return { reps: Math.max(2, Math.round((minutes * 60) / (workSec + restSec))), workSec, restSec, kind };
}

/** Which types fill the sessions of one week, in order of the days. The long one goes last, hard ones are kept apart by easy ones. */
function weekTypes(S, types, level, week, age) {
  const has = (t) => types.includes(t), out = [];
  const hard = [];
  if (has('long') && S >= 3) hard.push('long');
  if (has('intervals') && S >= 3 && (level !== 'beginner' || week >= 1)) hard.push('intervals');
  else if (has('intervals') && S === 2 && level !== 'beginner') hard.push('intervals');
  if (has('tempo') && S >= 4 && level !== 'beginner' && week >= 2) hard.push('tempo');
  const strength = has('strength') && (S >= 4 || age >= 65 || !hard.some((h) => h !== 'long')) && S >= 3 ? 1 : 0; // with 3 sessions the chosen hard types come first (seniors always get movement work)
  const easyCount = Math.max(0, S - hard.length - strength);
  const body = ['easy', ...hard.filter((h) => h !== 'long'), ...Array(Math.max(0, easyCount - 1)).fill('easy')]; // before the long one
  const withStrength = strength ? [...body.slice(0, 1), 'strength', ...body.slice(1)] : body;
  out.push(...withStrength.slice(0, S - (hard.includes('long') ? 1 : 0)));
  if (hard.includes('long')) out.push('long');
  while (out.length < S) out.splice(out.length - 1, 0, 'easy');
  // never two hard sessions in a row
  for (let i = 1; i < out.length; i++) if (HARD.has(out[i]) && HARD.has(out[i - 1]) && out[i] !== 'long') { out[i] = 'easy'; }
  return out.slice(0, S);
}

/**
 * Builds a plan. opts: { age, level, goal, sessions, types, weeks, startDay (local midnight of the first day, a Sunday), baseEffort (moderate-equivalent minutes
 * per week to start from), kind ('run' | 'walk'), habitDays (weekdays 0-6, most used first) }.
 */
export function generatePlan(opts) {
  const age = clamp(Math.round(opts.age) || 35, 5, 100), level = LEVELS.includes(opts.level) ? opts.level : 'beginner', goal = GOALS.includes(opts.goal) ? opts.goal : 'general';
  const S = clamp(Math.round(opts.sessions) || 3, MIN_SESSIONS, MAX_SESSIONS), weeks = clamp(Math.round(opts.weeks) || 8, MIN_WEEKS, MAX_WEEKS), kind = opts.kind === 'run' ? 'run' : 'walk';
  const types = (opts.types || ['easy', 'long', 'intervals']).filter((t) => TYPES.includes(t)), g = guideFor(age), factor = kind === 'run' ? 2 : 1;
  const start = Math.max(30, Math.min(g.ceiling, Math.round(opts.baseEffort || g.floor * 0.6)));
  const ceiling = goal === '10k' ? Math.max(g.ceiling, 320) : g.ceiling;
  // the days of the week: the person's own habit days when there are enough, else a sensible default spread
  const habit = [...new Set((opts.habitDays || []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].slice(0, S);
  const days = (habit.length >= S ? habit : DEFAULT_DAYS[S]).slice().sort((a, b) => a - b);
  const list = []; let effort = start;
  for (let w = 0; w < weeks; w++) {
    const recovery = w > 0 && w % 4 === 3, taper = w === weeks - 1 && weeks >= 6;
    if (w > 0) effort = recovery ? effort * 0.75 : (w % 4 === 0 && w > 4 ? effort / 0.75 : effort * (1 + rate(age)));
    const target = Math.min(ceiling, effort) * (taper ? 0.8 : 1), types7 = weekTypes(S, types, level, w, age), sum = types7.reduce((s, t) => s + (WEIGHT[t] || 0), 0) || 1;
    types7.forEach((type, i) => {
      const isStrength = type === 'strength', share = isStrength ? 0 : ((WEIGHT[type] || 0) / sum) * target;
      let minutes = isStrength ? (age >= 65 ? 15 : 20) : clamp(Math.round(share / factor / 5) * 5, 15, goal === '10k' ? 90 : 75);
      if (type === 'long' && goalLong(goal, w, weeks)) minutes = Math.max(minutes, goalLong(goal, w, weeks));
      list.push({ id: `s${w}-${i}`, week: w, day: days[i], type, kind: isStrength ? 'strength' : kind, minutes, effort: isStrength ? 0 : Math.round(minutes * factor),
        work: type === 'intervals' ? intervalStructure(level, w, minutes, kind) : null, status: 'planned', doneAt: 0, workoutAt: 0 });
    });
  }
  return { v: 1, id: `p${Date.now().toString(36)}`, createdAt: Date.now(), goal, level, kind, age, sessions: S, weeks, startDay: opts.startDay, types, list };
}
/** Minutes the long session should reach in week w for a distance goal (grows to the goal two weeks before the end). */
function goalLong(goal, w, weeks) {
  const peak = goal === '5k' ? 35 : goal === '10k' ? 60 : 0; if (!peak) return 0;
  const f = Math.min(1, (w + 1) / Math.max(1, weeks - 2)); return Math.round((peak * (0.45 + 0.55 * f)) / 5) * 5;
}

// ---------- dates and lookups ----------
export function sessionDate(plan, s) { const d = new Date(plan.startDay); d.setDate(d.getDate() + s.week * 7 + s.day); d.setHours(0, 0, 0, 0); return d.getTime(); }
export const weekIndex = (plan, now) => { const a = new Date(plan.startDay), b = new Date(dayStart(now)); return Math.floor(Math.round((b - a) / DAY) / 7); };
export const sessionsOfWeek = (plan, w) => plan.list.filter((s) => s.week === w).sort((a, b) => a.day - b.day);
export const planEnded = (plan, now) => weekIndex(plan, now) >= plan.weeks;

// ---------- matching finished workouts ----------
/** Marks sessions done when a workout of the right kind and about the planned length took place on that day. Returns { plan, matched: [session ids] }. */
export function matchSessions(plan, workouts) {
  const out = { ...plan, list: plan.list.map((s) => ({ ...s })) }, used = new Set(), matched = [];
  for (const s of out.list.filter((x) => x.status === 'planned' && x.kind !== 'strength').sort((a, b) => sessionDate(out, a) - sessionDate(out, b))) {
    const day = sessionDate(out, s);
    const w = workouts.find((x) => !used.has(x.startedAt) && dayStart(x.startedAt) === day && (s.kind === 'walk' ? true : x.kind === 'run') && x.movingMs / 60000 >= s.minutes * 0.7 - 1);
    if (w) { used.add(w.startedAt); s.status = 'done'; s.doneAt = w.endedAt || w.startedAt; s.workoutAt = w.startedAt; matched.push(s.id); }
  }
  return { plan: out, matched };
}

export const markDone = (plan, id, now) => ({ ...plan, list: plan.list.map((s) => (s.id === id && s.status === 'planned' ? { ...s, status: 'done', doneAt: now } : s)) });
export const markSkipped = (plan, id) => ({ ...plan, list: plan.list.map((s) => (s.id === id && s.status === 'planned' ? { ...s, status: 'skipped' } : s)) });

// ---------- missed sessions ----------
/** Planned sessions whose day has passed. */
export const missedSessions = (plan, now) => plan.list.filter((s) => s.status === 'planned' && sessionDate(plan, s) < dayStart(now));

const dayIndexOf = (plan, ms) => Math.round((dayStart(ms) - dayStart(plan.startDay)) / DAY);
/**
 * How to catch up on missed sessions (the last 7 days): move each to the nearest free day from today on (not next to another hard session, at most
 * 1 session a day), or skip it when it cannot be placed within 3 days or more than two are missed (the plan should not become a punishment).
 * Returns [{ id, action: 'move' | 'skip', week, day, ms, why }].
 */
export function catchUpOptions(plan, now) {
  const today = dayIndexOf(plan, now), missed = missedSessions(plan, now).filter((s) => today - (s.week * 7 + s.day) <= 7).sort((a, b) => (HARD.has(b.type) ? 1 : 0) - (HARD.has(a.type) ? 1 : 0) || a.week * 7 + a.day - (b.week * 7 + b.day));
  const taken = new Map(plan.list.filter((s) => s.status === 'planned' && s.week * 7 + s.day >= today).map((s) => [s.week * 7 + s.day, s]));
  const out = []; let moves = 0;
  for (const s of missed) {
    let placed = null;
    if (moves < 2) for (let d = today; d <= today + 3 && !placed; d++) {
      if (taken.has(d)) continue;
      const near = [taken.get(d - 1), taken.get(d + 1)].filter(Boolean);
      if (HARD.has(s.type) && near.some((n) => HARD.has(n.type))) continue;
      placed = d;
    }
    if (placed != null) { taken.set(placed, { ...s, week: Math.floor(placed / 7), day: placed % 7 }); moves++; out.push({ id: s.id, action: 'move', week: Math.floor(placed / 7), day: placed % 7, why: placed === today ? 'today' : 'soon' }); }
    else out.push({ id: s.id, action: 'skip', why: moves >= 2 ? 'many' : 'nospace' });
  }
  return out;
}
export const applyMove = (plan, id, week, day) => ({ ...plan, list: plan.list.map((s) => (s.id === id && s.status === 'planned' ? { ...s, week, day } : s)) });

/** After a week with two or more missed/skipped sessions the next week is made 15 % lighter (once). Returns { plan, changed }. */
export function adaptAfterMisses(plan, now) {
  const w = weekIndex(plan, now) - 1; if (w < 0 || w >= plan.weeks - 1 || (plan.adapted || []).includes(w)) return { plan, changed: false };
  const prev = sessionsOfWeek(plan, w), lost = prev.filter((s) => s.status === 'skipped' || (s.status === 'planned' && sessionDate(plan, s) < dayStart(now))).length;
  if (lost < 2) return { plan, changed: false };
  const factor = 0.85, next = plan.list.map((s) => (s.week === w + 1 && s.kind !== 'strength' && s.status === 'planned' ? { ...s, minutes: Math.max(15, Math.round((s.minutes * factor) / 5) * 5), effort: Math.round(Math.max(15, Math.round((s.minutes * factor) / 5) * 5) * (s.kind === 'run' ? 2 : 1)) } : s));
  return { plan: { ...plan, list: next, adapted: [...(plan.adapted || []), w] }, changed: true };
}

// ---------- progress ----------
/** { week, weekDone, weekTotal, effortDone, effortPlanned, next (the next planned session from today on), done, total, pct }. */
export function planProgress(plan, now) {
  const w = clamp(weekIndex(plan, now), 0, plan.weeks - 1), ws = sessionsOfWeek(plan, w), today = dayStart(now);
  const next = plan.list.filter((s) => s.status === 'planned' && sessionDate(plan, s) >= today).sort((a, b) => sessionDate(plan, a) - sessionDate(plan, b))[0] || null;
  const done = plan.list.filter((s) => s.status === 'done').length;
  return { week: w, weekDone: ws.filter((s) => s.status === 'done').length, weekTotal: ws.length, effortDone: ws.filter((s) => s.status === 'done').reduce((a, s) => a + s.effort, 0), effortPlanned: ws.reduce((a, s) => a + s.effort, 0),
    next, done, total: plan.list.length, pct: Math.round((done / Math.max(1, plan.list.length)) * 100) };
}

/** Untrusted plan (storage) -> a safe plan, or null. */
export function sanitizePlan(p) {
  if (!p || typeof p !== 'object' || p.v !== 1 || !Number.isFinite(p.startDay) || !Array.isArray(p.list)) return null;
  const weeks = clamp(Math.round(p.weeks) || 0, MIN_WEEKS, MAX_WEEKS), n = (v, lo, hi) => clamp(Math.round(Number(v)) || 0, lo, hi);
  const list = p.list.slice(0, 80).map((s, i) => (s && TYPES.includes(s.type) && ['run', 'walk', 'strength'].includes(s.kind) ? { id: /^[\w-]{1,12}$/.test(String(s.id)) ? String(s.id) : `x${i}`, week: n(s.week, 0, weeks - 1), day: n(s.day, 0, 6), type: s.type, kind: s.kind, minutes: n(s.minutes, 5, 180), effort: n(s.effort, 0, 400),
    work: s.work && typeof s.work === 'object' ? { reps: n(s.work.reps, 1, 30), workSec: n(s.work.workSec, 10, 900), restSec: n(s.work.restSec, 10, 900), kind: s.work.kind === 'run' ? 'run' : 'walk' } : null, status: ['planned', 'done', 'skipped'].includes(s.status) ? s.status : 'planned', doneAt: n(s.doneAt, 0, 4e12), workoutAt: n(s.workoutAt, 0, 4e12) } : null)).filter(Boolean);
  if (!list.length) return null;
  return { v: 1, id: cleanText(p.id, 20) || 'p', createdAt: n(p.createdAt, 0, 4e12), goal: GOALS.includes(p.goal) ? p.goal : 'general', level: LEVELS.includes(p.level) ? p.level : 'beginner', kind: p.kind === 'run' ? 'run' : 'walk', age: n(p.age, 5, 100), sessions: n(p.sessions, MIN_SESSIONS, MAX_SESSIONS), weeks, startDay: n(p.startDay, 0, 4e12),
    types: (Array.isArray(p.types) ? p.types : []).filter((t) => TYPES.includes(t)), list, adapted: (Array.isArray(p.adapted) ? p.adapted : []).map((x) => n(x, 0, MAX_WEEKS)).slice(0, MAX_WEEKS) };
}
