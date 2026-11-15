import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan, levelFromHistory, intervalStructure, sessionDate, weekIndex, sessionsOfWeek, matchSessions, markDone, markSkipped, missedSessions, catchUpOptions, applyMove, adaptAfterMisses, planProgress, sanitizePlan, HARD } from '../../web/js/plan.js';
import { dayStart, weekStart, DAY } from '../../web/js/stats.js';

const START = new Date(2026, 10, 8).getTime(); // Sunday 8 Nov 2026
const at = (week, day, hour = 7) => { const d = new Date(START); d.setDate(d.getDate() + week * 7 + day); d.setHours(hour, 0, 0, 0); return d.getTime(); };
const make = (o = {}) => generatePlan({ age: 35, level: 'beginner', goal: 'general', sessions: 3, types: ['easy', 'long', 'intervals', 'strength'], weeks: 8, startDay: START, baseEffort: 90, kind: 'run', ...o });
const wk = (when, min, kind = 'run') => ({ kind, startedAt: when, endedAt: when + min * 61000, movingMs: min * 60000, distanceM: min * 160, elapsedMs: min * 61000 });

test('plan: structure of an 8-week, 3-sessions plan; the long one ends the week, hard sessions never touch, sane minutes', () => {
  const p = make(); assert.equal(p.list.length, 24);
  for (let w = 0; w < 8; w++) {
    const ws = sessionsOfWeek(p, w); assert.equal(ws.length, 3); assert.deepEqual(ws.map((s) => s.day), [0, 2, 4]);
    for (let i = 1; i < ws.length; i++) assert.ok(!(HARD.has(ws[i].type) && HARD.has(ws[i - 1].type) && ws[i].day - ws[i - 1].day === 1), 'no hard sessions on consecutive days');
    for (const s of ws) assert.ok(s.kind === 'strength' ? s.minutes <= 20 : s.minutes >= 15 && s.minutes <= 75, `minutes ${s.minutes}`);
  }
  assert.ok(p.list.some((s) => s.type === 'long') && p.list.some((s) => s.type === 'intervals') && !p.list.some((s) => s.week >= 1 && s.type === 'strength'), 'with 3 sessions from week 2: easy, intervals, long');
  const four = make({ sessions: 4 }); assert.ok(four.list.some((s) => s.type === 'strength') && four.list.some((s) => s.type === 'intervals')); assert.ok(make({ age: 70 }).list.some((s) => s.type === 'strength'), 'seniors always get movement work');
  assert.equal(sessionDate(p, p.list[0]), START); assert.equal(weekIndex(p, at(1, 3)), 1); assert.equal(weekIndex(p, at(0, 0) - DAY), -1);
});
test('plan: the effort grows gently (<= ~10 %/week), has a lighter week every 4th, never beats the guideline ceiling; seniors grow slower', () => {
  const total = (p, w) => sessionsOfWeek(p, w).reduce((s, x) => s + x.effort, 0);
  const p = make({ baseEffort: 100, sessions: 4, types: ['easy', 'long', 'intervals', 'tempo'], level: 'regular' });
  for (let w = 1; w < 8; w++) { const g = total(p, w) / total(p, w - 1); assert.ok(g <= 1.2, `week ${w} grew ${g}`); }
  assert.ok(total(p, 3) < total(p, 2), 'recovery week'); for (let w = 0; w < 8; w++) assert.ok(total(p, w) <= 330);
  const senior = make({ age: 70, baseEffort: 100 }), adult = make({ baseEffort: 100 }); assert.ok(total(senior, 6) < total(adult, 6));
  assert.equal(make({ age: 70 }).list.find((s) => s.type === 'strength').minutes, 15);
});
test('plan: intervals are run/walk for beginners and progress; goals shape the long session; habit days are used', () => {
  assert.deepEqual(intervalStructure('beginner', 0, 30, 'run'), { reps: 10, workSec: 60, restSec: 120, kind: 'run' }); assert.ok(intervalStructure('beginner', 8, 30, 'run').workSec > 120);
  const five = make({ goal: '5k', weeks: 10, level: 'regular', baseEffort: 120 }), longs = five.list.filter((s) => s.type === 'long');
  assert.ok(longs[longs.length - 2].minutes >= 30 && longs[0].minutes < longs[longs.length - 2].minutes, JSON.stringify(longs.map((l) => l.minutes)));
  const hab = make({ habitDays: [2, 4, 6] }); assert.deepEqual(sessionsOfWeek(hab, 0).map((s) => s.day), [2, 4, 6]); assert.deepEqual(sessionsOfWeek(make({ habitDays: [1] }), 0).map((s) => s.day), [0, 2, 4], 'too few habit days: default spread');
  assert.equal(make({ sessions: 99, weeks: 99 }).sessions, 6); assert.equal(make({ weeks: 1 }).weeks, 4);
  assert.equal(levelFromHistory([], NOW), 'beginner');
});
const NOW = at(1, 1, 18);

test('matching: a workout of the right kind and about the planned length on the day completes the session; short or other days do not', () => {
  const p = make(), s0 = p.list[0], s1 = p.list[1];
  const r = matchSessions(p, [wk(at(0, 0), s0.minutes), wk(at(0, 2), 5), wk(at(0, 5), s1.minutes)]);
  assert.deepEqual(r.matched, [s0.id]); assert.equal(r.plan.list[0].status, 'done'); assert.equal(r.plan.list[1].status, 'planned'); assert.equal(p.list[0].status, 'planned', 'the input is not mutated');
  const walkPlan = make({ kind: 'walk' }); assert.equal(matchSessions(walkPlan, [wk(at(0, 0), walkPlan.list[0].minutes, 'run')]).matched.length, 1, 'a run also counts for a walking session');
  assert.equal(matchSessions(p, [wk(at(0, 0), s0.minutes, 'walk')]).matched.length, 0, 'a walk does not count for a running session');
  const sp = make({ sessions: 4 }), strength = sp.list.find((s) => s.kind === 'strength'); assert.equal(matchSessions(sp, [wk(sessionDate(sp, strength) + 3600000, 30)]).matched.includes(strength.id), false);
  assert.equal(markDone(p, s0.id, 5).list[0].status, 'done'); assert.equal(markSkipped(p, s0.id).list[0].status, 'skipped');
});
test('missed sessions: moved to the nearest free day (hard ones not next to hard ones), skipped when there is no room or too many are missed', () => {
  const p = make(); const now = at(0, 3, 10); // Wed after Sun and Tue sessions were missed; Thu (day 4) is planned
  assert.equal(missedSessions(p, now).length, 2);
  const opts = catchUpOptions(p, now); assert.equal(opts.length, 2); assert.ok(opts.every((o) => o.action === 'move' || o.action === 'skip'));
  const moved = opts.filter((o) => o.action === 'move'); for (const o of moved) assert.ok(o.week * 7 + o.day >= 3 && o.week * 7 + o.day <= 6, 'within 3 days from today');
  const days = moved.map((o) => o.week * 7 + o.day); assert.equal(new Set(days).size, days.length, 'one session per day'); assert.ok(!days.includes(4), 'not on a day that already has a session');
  const many = make({ sessions: 6 }), o2 = catchUpOptions(many, at(0, 6, 10)); assert.ok(o2.filter((o) => o.action === 'move').length <= 2); assert.equal(o2.length, 5, 'every missed session gets an answer'); assert.ok(o2.every((o) => o.action === 'skip'), 'no free day within 3 days: skipped, not piled up');
  const moved2 = applyMove(p, p.list[0].id, 0, 3); assert.equal(sessionDate(moved2, moved2.list[0]), at(0, 3, 0));
});
test('adaptation: two lost sessions make the next week 15 % lighter, once; progress reports the week and the next session', () => {
  const p = make(), now = at(1, 1, 9), before = sessionsOfWeek(p, 1).filter((s) => s.kind !== 'strength').map((s) => s.minutes);
  const r = adaptAfterMisses(p, now); assert.equal(r.changed, true); const after = sessionsOfWeek(r.plan, 1).filter((s) => s.kind !== 'strength').map((s) => s.minutes);
  after.forEach((m, i) => assert.ok(m <= before[i] && m >= 15)); assert.ok(after.some((m, i) => m < before[i]), 'lighter'); assert.equal(adaptAfterMisses(r.plan, now).changed, false, 'only once');
  const done = markDone(markDone(p, sessionsOfWeek(p, 0)[0].id, 1), sessionsOfWeek(p, 0)[1].id, 1); assert.equal(adaptAfterMisses(done, now).changed, false, 'one miss is fine');
  const g = planProgress(p, now); assert.equal(g.week, 1); assert.equal(g.weekTotal, 3); assert.equal(g.next.week, 1); assert.equal(g.pct, 0); assert.ok(planProgress(markDone(p, p.list[0].id, 1), now).pct > 0);
});
test('sanitizePlan: hostile storage cannot break the plan', () => {
  assert.equal(sanitizePlan(null), null); assert.equal(sanitizePlan({ v: 2 }), null); assert.equal(sanitizePlan({ v: 1, startDay: 1, list: [] }), null);
  const p = sanitizePlan({ v: 1, startDay: START, weeks: 999, goal: '__proto__', kind: 'x', types: ['easy', 'bad'], list: [{ id: '<b>x</b>', week: 99, day: -5, type: 'easy', kind: 'run', minutes: 1e9, effort: -1, status: 'hacked', work: { reps: 1e9, workSec: 1, restSec: 5000, kind: 'z' } }, { type: 'nope' }, null] });
  assert.equal(p.weeks, 12); assert.equal(p.goal, 'general'); assert.equal(p.kind, 'walk'); assert.deepEqual(p.types, ['easy']); assert.equal(p.list.length, 1);
  const s = p.list[0]; assert.equal(s.week, 11); assert.equal(s.day, 0); assert.equal(s.minutes, 180); assert.equal(s.status, 'planned'); assert.equal(s.work.reps, 30); assert.equal(s.work.workSec, 10); assert.equal(s.work.restSec, 900); assert.ok(!/[<>]/.test(s.id));
});

import { planEntries } from '../../web/js/schedule.js';
test('plan reminders: one notification at the chosen hour for each planned session still ahead within a week', () => {
  const p = make(), now = at(0, 0, 6), e = planEntries(p, now, 18, (s) => ({ title: 't', body: s.type }), (s) => sessionDate(p, s));
  assert.ok(e.length >= 3 && e.every((x) => x.at > now && new Date(x.at).getHours() === 18 && x.href === '#/plan' && x.meta.min > 0)); assert.equal(new Set(e.map((x) => x.id)).size, e.length);
  const done = markDone(p, p.list[0].id, 1); assert.equal(planEntries(done, now, 18, () => ({ title: 't', body: 'b' }), (s) => sessionDate(done, s)).length, e.length - 1, 'a done session has no reminder');
  assert.equal(planEntries(p, at(3, 0), 18, () => ({ title: 't', body: 'b' }), (s) => sessionDate(p, s)).filter((x) => x.at < at(3, 0)).length, 0);
});
