// Training plan screen: build a plan (goal, level, sessions per week, workout types), see the week, start or mark sessions, catch up on missed ones.
// Plan logic is pure (plan.js); this file draws it and stores it (localStorage `da.plan`).
import { h, setChildren, clamp } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { listWorkouts, profile, getJson, setJson, getPref } from '../store.js';
import { weeklyTarget } from '../effort.js';
import { dayStart } from '../stats.js';
import { GOALS, TYPES, LEVELS, generatePlan, habitWeekdays, expireOld, levelFromHistory, sanitizePlan, sessionDate, sessionsOfWeek, weekIndex, matchSessions, markDone, markSkipped, applyMove, catchUpOptions, adaptAfterMisses, planProgress, planEnded } from '../plan.js';
import { syncNative } from '../syncNative.js';

const GOAL_KEY = { general: 'goalGeneral', '5k': 'goal5k', '10k': 'goal10k', weight: 'goalWeight' }, LV_KEY = { beginner: 'lvBeginner', regular: 'lvRegular', advanced: 'lvAdvanced' };
const cap = (s) => s[0].toUpperCase() + s.slice(1), TY_KEY = (x) => `ty${cap(x)}`;
const say = (m) => { const sr = document.getElementById('sr'); if (sr) sr.textContent = m; };
export const loadPlan = () => sanitizePlan(getJson('plan', null));
export const savePlan = (p) => { setJson('plan', p); syncNative(); };
const dateLabel = (ms) => new Date(ms).toLocaleDateString(getLang() === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'numeric' });
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** What a session is, in words: type + length + the run/walk structure for intervals. */
export function sessionTitle(s) { return `${t(TY_KEY(s.type))} · ${t('planMin', { n: s.minutes })}`; }
export function sessionDetail(s) { return s.work ? t(s.work.kind === 'run' ? 'ivRun' : 'ivWalk', { reps: s.work.reps, work: mmss(s.work.workSec), rest: mmss(s.work.restSec) }) : t(`${TY_KEY(s.type)}D`); }

function exercises(age) {
  const k = age >= 65 ? ['exChair', 'exHeel', 'exBalance', 'exMarch', 'exReach'] : ['exSquat', 'exLunge', 'exCalf', 'exBridge', 'exPlank', 'exStretch'];
  return h('details', { class: 'ex' }, h('summary', null, t('exTitle')), h('ul', null, k.map((x) => h('li', null, t(x)))));
}

/** After a workout is saved: completes a matching planned session. Returns that session or null. */
export function matchAfterWorkout(rec) {
  const plan = loadPlan(); if (!plan) return null;
  const r = matchSessions(plan, [rec]); if (!r.matched.length) return null;
  savePlan(r.plan); return r.plan.list.find((s) => s.id === r.matched[0]);
}

// ---------- the builder ----------
async function builder(box, redraw, mine) {
  const rows = await listWorkouts({ points: false }), prof = profile(), now = Date.now(); if (box.alive === false || box.seq !== mine) return;
  const sel = (id, label, items, value) => h('div', { class: 'field' }, h('label', { for: id }, label), h('select', { id }, items.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l))));
  const types = h('div', { class: 'checks', role: 'group', 'aria-label': t('planTypes') }, TYPES.map((x) => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: x, checked: x !== 'tempo' }), h('span', null, `${t(TY_KEY(x))} - ${t(`${TY_KEY(x)}D`)}`))));
  setChildren(box, h('h2', null, t('planBuild')),
    sel('p-goal', t('planGoal'), GOALS.map((g) => [g, t(GOAL_KEY[g])]), 'general'), sel('p-level', t('planLevel'), LEVELS.map((l) => [l, t(LV_KEY[l])]), levelFromHistory(rows, now)),
    sel('p-kind', t('planKind'), [['walk', t('walk')], ['run', t('run')]], getPref('recoKind', 'walk') === 'run' ? 'run' : 'walk'),
    sel('p-sessions', t('planSessions'), [2, 3, 4, 5, 6].map((n) => [n, String(n)]), 3), sel('p-weeks', t('planWeeks'), [4, 6, 8, 10, 12].map((n) => [n, String(n)]), 8),
    h('h3', null, t('planTypes')), types, h('p', { class: 'note' }, t('planDaysNote')), h('p', { class: 'note' }, t('planDisclaimer')),
    h('button', { type: 'button', class: 'btn', id: 'plan-create', onclick: () => {
      const v = (id) => box.querySelector(`#${id}`).value, S = Number(v('p-sessions')), tp = [...box.querySelectorAll('.checks input:checked')].map((i) => i.value);
      const days = habitWeekdays(rows, now, v('p-kind'), S);
      const d0 = new Date(dayStart(now)); if (d0.getDay() !== 0) d0.setDate(d0.getDate() + (7 - d0.getDay()));
      const plan = generatePlan({ age: prof.age, level: v('p-level'), goal: v('p-goal'), sessions: S, types: tp.length ? tp : ['easy'], weeks: Number(v('p-weeks')), startDay: d0.getTime(), baseEffort: weeklyTarget(rows, prof.age, now).minutes, kind: v('p-kind'), habitDays: days });
      savePlan(plan); redraw(); } }, t('planStart')));
}

// ---------- the plan ----------
async function view(box, redraw, mine, first) {
  const now = Date.now();
  let plan = loadPlan(); if (!plan) return builder(box, redraw, mine);
  if (first) { // matching, expiring and adapting happen when the screen opens, not on every tap
    const rows = await listWorkouts({ points: false }); if (box.alive === false || box.seq !== mine) return;
    const m = matchSessions(plan, rows); if (m.matched.length) { plan = m.plan; savePlan(plan); say(t('planSessionDone')); }
    const e = expireOld(plan, now); if (e.changed) { plan = e.plan; savePlan(plan); }
    const a = adaptAfterMisses(plan, now); if (a.changed) { plan = a.plan; savePlan(plan); }
  }
  if (box.alive === false || box.seq !== mine) return; // only the newest draw paints
  if (box.dataset.planId !== plan.id) { delete box.dataset.week; box.dataset.planId = plan.id; } // a new plan opens on its own current week
  const prof = planProgress(plan, now), shown = clamp(Number(box.dataset.week ?? prof.week), 0, plan.weeks - 1), act = (fn) => () => { savePlan(fn(plan)); redraw(); };
  const missed = catchUpOptions(plan, now), byId = new Map(plan.list.map((s) => [s.id, s])), today = dayStart(now);
  const nav = (d, key) => h('button', { type: 'button', class: 'round', 'aria-label': t(key), disabled: shown + d < 0 || shown + d >= plan.weeks, onclick: () => { box.dataset.week = String(shown + d); redraw(); } }, icon(d < 0 ? 'back' : 'forward', 22));
  const card = (s) => {
    const when = sessionDate(plan, s), isToday = when === today, late = s.status === 'planned' && when < today;
    return h('article', { class: `session ${s.status} ${late ? 'late' : ''}`, 'data-session': s.id, 'data-status': late ? 'missed' : s.status },
      h('div', { class: 'rhead' }, icon(s.kind === 'strength' ? 'activity' : s.kind, 22), h('b', null, sessionTitle(s)), h('span', { class: 'tag' }, s.status === 'done' ? t('planDone') : s.status === 'skipped' ? t('planSkipped') : late ? t('planMissed') : isToday ? t('planToday') : '')),
      h('small', null, dateLabel(when)), h('p', null, sessionDetail(s)), s.kind === 'strength' ? exercises(plan.age) : null,
      s.status === 'planned' ? h('div', { class: 'row-actions' }, s.kind === 'strength' ? null : h('a', { class: 'btn', href: `#/workout/${s.kind}/go` }, icon('play', 20), t('planGo')),
        h('button', { type: 'button', class: 'btn ghost', 'data-act': 'done', onclick: act((p) => markDone(p, s.id, Date.now())) }, t('planMarkDone')), h('button', { type: 'button', class: 'btn ghost', 'data-act': 'skip', onclick: act((p) => markSkipped(p, s.id)) }, t('planSkip'))) : null);
  };
  const up = prof.next;
  setChildren(box,
    plan.adapted?.includes(prof.week - 1) ? h('p', { class: 'note' }, t('planAdapted')) : null,
    planEnded(plan, now) ? h('p', { class: 'good' }, t('planEnded')) : null,
    h('div', { class: 'planhead' }, nav(-1, 'planPrev'), h('div', { class: 'grow' }, h('b', null, t('planWeek', { n: shown + 1, total: plan.weeks })), h('small', null, `${t(GOAL_KEY[plan.goal])} · ${t(LV_KEY[plan.level])}`)), nav(1, 'planNext')),
    h('div', { class: 'meter', role: 'img', 'aria-label': t('planProgressText', { done: prof.done, total: prof.total }) }, h('span', { style: { 'inline-size': `${prof.pct}%` } })), h('small', null, t('planProgressText', { done: prof.done, total: prof.total })),
    shown === prof.week ? h('small', null, t('planWeekEffort', { done: prof.effortDone, planned: prof.effortPlanned })) : null,
    up && shown === prof.week ? h('p', { class: 'note' }, t('planNextUp', { what: sessionTitle(up), when: dateLabel(sessionDate(plan, up)) })) : null,
    missed.length ? h('div', { class: 'card catch', role: 'group', 'aria-label': t('planCatchTitle', { n: missed.length }) }, h('h3', null, t('planCatchTitle', { n: missed.length })), h('p', { class: 'note' }, t('planCatchHint')),
      missed.map((o) => { const s = byId.get(o.id); return h('div', { class: 'catchrow', 'data-catch': o.id }, h('span', { class: 'grow' }, `${sessionTitle(s)} · ${dateLabel(sessionDate(plan, s))}`),
        o.action === 'move' ? h('button', { type: 'button', class: 'btn', 'data-act': 'move', onclick: act((p) => applyMove(p, o.id, o.week, o.day)) }, t('planMoveTo', { when: o.why === 'today' ? t('whenToday') : dateLabel(sessionDate(plan, o)) })) : h('small', null, t('whySkipNospace')),
        h('button', { type: 'button', class: 'btn ghost', 'data-act': 'skip', onclick: act((p) => markSkipped(p, o.id)) }, t('planCatchSkip'))); })) : null,
    h('div', { class: 'list' }, sessionsOfWeek(plan, shown).map(card)),
    h('p', { class: 'note' }, t('planDisclaimer')),
    h('div', { class: 'row-actions' }, h('button', { type: 'button', class: 'btn ghost', id: 'plan-new', onclick: () => { setJson('plan', null); syncNative(); redraw(); } }, t('planNew')),
      h('button', { type: 'button', class: 'btn danger', id: 'plan-delete', onclick: () => { if (confirm(t('planDeleteAsk'))) { setJson('plan', null); syncNative(); redraw(); } } }, icon('trash', 20), t('planDelete'))));
}

/** Fills `box` (screen and dashboard drill-down). */
export function mountPlan(box) {
  let first = true;
  const redraw = () => { box.alive = true; box.seq = (box.seq || 0) + 1; view(box, redraw, box.seq, first); first = false; };
  redraw();
}
export function renderPlan() {
  const box = h('div', { class: 'planbox' }), el = h('section', { class: 'plan' }, h('h1', null, t('planTitle')), box);
  mountPlan(box); el.cleanup = () => { box.alive = false; }; return el;
}

/** Sync summary for the dashboard widget. */
export function planSummary(now = Date.now()) {
  const plan = loadPlan(); if (!plan) return h('p', { class: 'note' }, t('planNone'));
  const p = planProgress(plan, now), meter = h('div', { class: 'meter', role: 'img', 'aria-label': t('planProgressText', { done: p.done, total: p.total }) }, h('span', { style: { 'inline-size': `${p.pct}%` } }));
  return h('div', null, h('div', { class: 'stat' }, h('b', { class: 'big' }, t('planWeek', { n: p.week + 1, total: plan.weeks })), h('small', null, p.next ? t('planNextUp', { what: sessionTitle(p.next), when: dateLabel(sessionDate(plan, p.next)) }) : t('planEnded'))), meter);
}
