import test from 'node:test';
import assert from 'node:assert/strict';
import { weekStart, dayStart, bucketize, streak, personalBests, weatherBucket, paceByWeather, filterWorkouts, totals, DAY } from '../../web/js/stats.js';
import { estimateSteps, qualityFactor, daySteps, stepSeries, recommendedSteps, baseDailySteps } from '../../web/js/steps.js';
import { effortMinutes, weeklyTarget, checkWorkout, weekStatus, guideFor } from '../../web/js/effort.js';
import { sanitizeReminders, sanitizeSmart, dueReminders, smartNudge } from '../../web/js/reminders.js';
import { sanitizeAlerts, addAlert, unreadCount, markAllRead } from '../../web/js/alerts.js';
import { normalize, buildIndex, search } from '../../web/js/search.js';

const NOW = new Date(2026, 10, 12, 10, 0).getTime(); // Thursday 12 Nov 2026, 10:00
const at = (daysAgo, h = 7) => { const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(h, 0, 0, 0); return d.getTime(); };
const wk = (daysAgo, km, min, kind = 'run', extra = {}) => ({ kind, startedAt: at(daysAgo), distanceM: km * 1000, movingMs: min * 60000, elapsedMs: min * 60000 * 1.02, splits: [], ...extra });

// a workout in the Nth complete week before this one (1 = last week) on weekday `dow` (0 = Sunday)
const inWeek = (n, dow, km, min, kind = 'run', extra = {}) => { const d = new Date(weekStart(NOW)); d.setDate(d.getDate() - 7 * n + dow); d.setHours(7, 0, 0, 0); return { kind, startedAt: d.getTime(), distanceM: km * 1000, movingMs: min * 60000, elapsedMs: min * 60000 * 1.02, splits: [], ...extra }; };
const history = (weeks, km = 5, min = 30) => { const h = []; for (let n = 1; n <= weeks; n++) for (const dow of [0, 2, 4]) h.push(inWeek(n, dow, km, min)); return h; };

test('week starts on Sunday; buckets include empty days; streak counts back from today or yesterday', () => {
  assert.equal(new Date(weekStart(NOW)).getDay(), 0); assert.equal(new Date(weekStart(NOW)).getDate(), 8);
  const rows = [wk(0, 5, 30), wk(1, 3, 20), wk(2, 4, 25), wk(5, 6, 40)];
  const b = bucketize(rows, 'day', 7, NOW); assert.equal(b.length, 7); assert.equal(b[6].n, 1); assert.equal(b[3].n, 0); assert.equal(b[1].n, 1);
  assert.equal(streak(rows, NOW), 3); assert.equal(streak([wk(1, 3, 20)], NOW), 1); assert.equal(streak([wk(3, 3, 20)], NOW), 0);
});
test('personal bests: longest, fastest average pace, fastest km from splits', () => {
  const a = wk(3, 10, 60, 'run', { splits: [{ km: 1, atMs: 380000 }, { km: 2, atMs: 700000 }] }), b = wk(2, 5, 24);
  const pb = personalBests([a, b]); assert.equal(pb.longest, a); assert.equal(pb.fastest, b); assert.equal(pb.bestKm.ms, 320000); assert.equal(pb.bestKm.km, 2);
});
test('weather buckets and pace by weather ignore missing weather and short workouts', () => {
  assert.equal(weatherBucket(null), 'none'); assert.equal(weatherBucket({ tempC: 5 }), 'cold'); assert.equal(weatherBucket({ tempC: 30, cond: 'rain' }), 'rain'); assert.equal(weatherBucket({ tempC: 27 }), 'hot');
  const rows = [wk(1, 5, 30, 'run', { weather: { tempC: 30 } }), wk(2, 5, 25, 'run', { weather: { tempC: 12 } }), wk(3, 0.5, 5, 'run', { weather: { tempC: 12 } }), wk(4, 5, 28)];
  const r = paceByWeather(rows); assert.deepEqual(r.map((x) => x.bucket), ['cool', 'hot']); assert.ok(r[1].paceSec > r[0].paceSec);
});
test('filterWorkouts by period, kind, weather and text; totals', () => {
  const rows = [wk(1, 5, 30, 'run', { weather: { tempC: 30 } }), wk(10, 3, 30, 'walk'), wk(40, 8, 50, 'run')];
  assert.equal(filterWorkouts(rows, { since: at(30) }).length, 2); assert.equal(filterWorkouts(rows, { kind: 'walk' }).length, 1); assert.equal(filterWorkouts(rows, { weather: 'hot' }).length, 1);
  assert.equal(filterWorkouts(rows, { text: 'ZZ' }, () => 'abc zz').length, 3); assert.equal(totals(rows).distanceM, 16000);
});

test('steps: stride grows when running; quality rewards brisk continuous bouts and discounts strolling', () => {
  assert.ok(estimateSteps(wk(0, 5, 60, 'walk'), 170) > estimateSteps(wk(0, 5, 30, 'run'), 170)); assert.equal(estimateSteps({ kind: 'walk', distanceM: 0 }, 170), 0);
  assert.equal(qualityFactor(wk(0, 2, 60, 'walk')), 0.5, 'a 2 km/h stroll'); assert.equal(qualityFactor(wk(0, 5, 60, 'walk')), 1.0 * 1.2, 'brisk and unbroken for 60 min');
  assert.equal(qualityFactor(wk(0, 8, 40, 'run')), 1.2 * 1.2); assert.equal(qualityFactor(wk(0, 5, 60, 'walk', { elapsedMs: 120 * 60000 })), 1, 'many stops: no bonus');
  const d = daySteps([wk(0, 5, 40, 'run')]); assert.ok(d.quality > d.steps && d.brisk === d.steps && d.longestM === 5000 && d.activeMin === 40);
  assert.equal(stepSeries([wk(0, 5, 30)], 14, NOW).length, 14); assert.ok(stepSeries([wk(0, 5, 30)], 14, NOW)[13].steps > 0); assert.equal(stepSeries([wk(0, 5, 30)], 14, NOW)[0].steps, 0);
  assert.equal(baseDailySteps(10), 12000); assert.equal(baseDailySteps(40), 8000); assert.equal(baseDailySteps(70), 7000);
});
test('recommended steps: age base with little data, personalised (+10 %) within 50-150 % of the base otherwise', () => {
  assert.equal(recommendedSteps([], 40), 8000);
  const series = [3, 4, 5, 6].map((d) => ({ quality: 10000 + d * 100 })); const r = recommendedSteps(series, 40); assert.ok(r > 10000 && r <= 12000, `r ${r}`);
  assert.equal(recommendedSteps([1, 2, 3].map(() => ({ quality: 100000 })), 40), 12000);
});

test('effort: minutes count by activity; the bar follows the median of recent weeks +10 %, starts gently, never above the guideline ceiling', () => {
  assert.equal(effortMinutes(wk(0, 5, 30, 'run')), 60); assert.equal(effortMinutes(wk(0, 3, 40, 'walk')), 40, '4.5 km/h is a brisk walk: 1x'); assert.equal(effortMinutes(wk(0, 2.5, 40, 'walk')), 20, 'an easy 3.75 km/h walk: half');
  assert.equal(effortMinutes(wk(0, 1, 60, 'walk')), 0, 'a very slow walk');
  assert.equal(guideFor(10).floor, 420); assert.equal(guideFor(40).ceiling, 300);
  assert.equal(weeklyTarget([], 40, NOW).minutes, 90, 'a beginner starts at 60 % of 150');
  const hist = history(4, 4, 30); // 3 runs of 60 effort-min a week = 180/week
  const p = weeklyTarget(hist, 40, NOW); assert.ok(p.minutes >= 190 && p.minutes <= 205, `target ${p.minutes}`); assert.equal(p.steady, true);
  hist.push(inWeek(1, 6, 30, 200)); assert.ok(weeklyTarget(hist, 40, NOW).minutes <= 300, 'ceiling');
});
test('effort: one huge week cannot drag the bar up (median)', () => {
  const normal = history(3, 4, 30);
  const base = weeklyTarget(normal, 40, NOW).minutes; const withBig = weeklyTarget([...normal, inWeek(4, 3, 40, 300)], 40, NOW).minutes;
  assert.ok(withBig - base <= 25, `${base} -> ${withBig}`);
});
test('effort: a much longer run raises a notice with a gentle new target; a normal run does not', () => {
  const before = history(4, 5, 30);
  assert.equal(checkWorkout(wk(0, 5.5, 33, 'run'), before, 40, NOW), null);
  assert.equal(checkWorkout(wk(0, 2, 20, 'walk'), history(4, 5, 30).map((x) => ({ ...x, startedAt: x.startedAt - 60 * 86400000 })), 40, NOW), null, 'after a long break there is nothing recent to compare with (no false alarm)');
  const c = checkWorkout(wk(0, 12, 70, 'run'), before, 40, NOW); assert.equal(c.id, 'long'); assert.ok(c.params.ratio >= 200 && c.level === 'warn');
  const plan = weeklyTarget(before, 40, NOW).minutes; assert.ok(c.newTarget > plan && c.newTarget <= Math.round(plan * 1.1) + 1, `new ${c.newTarget} vs ${plan}`);
  assert.equal(checkWorkout(wk(0, 12, 70, 'run'), before.slice(0, 2), 40, NOW), null, 'needs a real history');
});
test('effort: fast runs and a surge week are flagged', () => {
  const before = history(4, 5, 30);
  assert.equal(checkWorkout(wk(0, 5, 22, 'run'), before, 40, NOW).id, 'fast');
  const surgeBefore = [...before, inWeek(0, 0, 5, 30), inWeek(0, 1, 5, 30), inWeek(0, 2, 5, 30), inWeek(0, 3, 5, 30)]; // four runs this week already
  const s = checkWorkout(wk(0, 5, 30, 'run'), surgeBefore, 40, NOW); assert.equal(s?.id, 'surge');
  const st = weekStatus(before, 40, NOW); assert.ok(['ahead', 'on', 'behind'].includes(st.status));
});

test('reminders: sanitising, due window (also across midnight), smart nudge rules', () => {
  const list = sanitizeReminders([{ time: '7:05', kind: 'x', days: [1, 1, 9, '2'] }, { time: '25:00' }, 'bad', { time: '18:30', days: [0, 1, 2, 3, 4, 5, 6], on: false }]);
  assert.equal(list.length, 2); assert.equal(list[0].time, '07:05'); assert.equal(list[0].kind, 'walk'); assert.deepEqual(list[0].days, [1, 2]); assert.equal(sanitizeReminders(new Array(50).fill({ time: '08:00' })).length, 12);
  const r = [{ id: 'a', kind: 'walk', time: '10:00', days: [4], on: true }];
  assert.equal(dueReminders(r, NOW - 30000, NOW).length, 1); assert.equal(dueReminders(r, NOW, NOW + 60000).length, 0); assert.equal(dueReminders([{ ...r[0], days: [5] }], NOW - 30000, NOW).length, 0);
  const mid = [{ id: 'm', kind: 'move', time: '23:59', days: [0, 1, 2, 3, 4, 5, 6], on: true }]; const just = new Date(2026, 10, 13, 0, 0, 20).getTime();
  assert.equal(dueReminders(mid, just - 120000, just).length, 1);
  const smart = sanitizeSmart({ on: true, afterMin: 1, maxPerDay: 99 }); assert.equal(smart.afterMin, 30); assert.equal(smart.maxPerDay, 8);
  const s = { ...smart, afterMin: 90 }, ctx = { lastMoveAt: NOW - 2 * 3600000, nudgesToday: 0, lastNudgeAt: 0, stepsToday: 1000, goalSteps: 8000, weekBehind: false, activeNow: false };
  assert.deepEqual(smartNudge(s, ctx, NOW), { kind: 'move', why: 'idle' });
  assert.equal(smartNudge({ ...s, on: false }, ctx, NOW), null); assert.equal(smartNudge(s, { ...ctx, activeNow: true }, NOW), null); assert.equal(smartNudge(s, { ...ctx, lastMoveAt: NOW - 30 * 60000 }, NOW), null);
  assert.equal(smartNudge(s, { ...ctx, stepsToday: 9000 }, NOW), null, 'goal met'); assert.equal(smartNudge({ ...s, maxPerDay: 3 }, { ...ctx, nudgesToday: 3 }, NOW), null); assert.equal(smartNudge(s, { ...ctx, lastNudgeAt: NOW - 30 * 60000 }, NOW), null);
  assert.equal(smartNudge(s, ctx, new Date(2026, 10, 12, 23, 0).getTime()), null, 'quiet at night'); assert.equal(smartNudge(s, ctx, new Date(2026, 10, 12, 6, 0).getTime()), null);
  const late = new Date(2026, 10, 12, 17, 0).getTime(); assert.deepEqual(smartNudge(s, { ...ctx, lastMoveAt: late - 4 * 3600000, weekBehind: true }, late), { kind: 'walk', why: 'behind' });
});
test('alerts: sanitised (keys only, safe links), newest first, bounded, unread count', () => {
  const l = sanitizeAlerts([{ id: 'a', ts: 5, kind: 'effort', title: 'eff_long_title', lines: ['eff_long_why', 'bad key!'], params: { km: 12, '__proto__': 1, x: '<b>' }, href: '#/alerts', read: false }, { id: 'b', title: 'bad title!' }, { id: 'c', title: 'ok', href: 'javascript:alert(1)' }]);
  assert.equal(l.length, 2); assert.deepEqual(l[0].lines, ['eff_long_why']); assert.equal(l[0].params.km, 12); assert.equal(Object.hasOwn(l[0].params, '__proto__'), false); assert.equal(l[1].href, '');
  let a = []; for (let i = 0; i < 120; i++) a = addAlert(a, { id: 'i' + i, ts: i, title: 't', lines: [], params: {}, kind: 'info', level: 'notice', href: '', read: false }); assert.equal(a.length, 100); assert.equal(a[0].id, 'i119');
  assert.equal(unreadCount(a), 100); assert.equal(unreadCount(markAllRead(a)), 0);
});
test('search: Hebrew and English, vowel marks, final letters, quotes; ranks title over text', () => {
  assert.equal(normalize('קִצְבָּ ם'), normalize('קצב ם')); assert.equal(normalize('5.20 km.'), '5.20 km'); assert.equal(normalize('ק״מ'), normalize('קמ')); assert.equal(normalize('Pace!'), 'pace');
  const idx = buildIndex([{ id: 1, type: 'setting', title: 'Breathing pattern', text: 'דפוס נשימה breath' }, { id: 2, type: 'workout', title: 'Run 5.20 km', text: 'ריצה run pace', ts: 5 }, { id: 3, type: 'setting', title: 'Pace alerts', text: '' }]);
  assert.deepEqual(search(idx, 'נשימה').map((x) => x.id), [1]); assert.deepEqual(search(idx, 'pace').map((x) => x.id), [3, 2]); assert.deepEqual(search(idx, 'run 5.2').map((x) => x.id), [2]);
  assert.deepEqual(search(idx, '   '), []); assert.deepEqual(search(idx, 'zzz'), []); assert.deepEqual(search(idx, 'breath pat').map((x) => x.id), [1]);
});

test('regression: a low-activity person gets a bar that follows them (not 4.5x), the ceiling raise is not offered, smart hours stay inside one day', () => {
  const light = []; for (let n = 1; n <= 4; n++) light.push(inWeek(n, 2, 2, 10, 'walk')); // ~ 10 effort min a week
  assert.equal(weeklyTarget(light, 40, NOW).minutes, 30, 'minimum bar, not 90');
  const atCeiling = history(4, 12, 75); const w = wk(0, 30, 200, 'run'); const c = checkWorkout(w, atCeiling, 40, NOW); assert.ok(c); assert.ok(c.newTarget === 0 || c.newTarget > c.plan, 'never a no-op raise');
  const s = sanitizeSmart({ on: true, fromHour: 22, toHour: 6 }); assert.ok(s.toHour > s.fromHour);
  assert.equal(weeklyTarget(history(4, 4, 30), 40, NOW, { week: weekStart(NOW), minutes: 200 }).minutes, 200, 'override honoured'); assert.equal(weeklyTarget(history(4, 4, 30), 40, NOW, { week: weekStart(NOW) - 7 * DAY, minutes: 200 }).overridden, false, 'an old override expires');
});

import { blendDay } from '../../web/js/steps.js';
import { reminderEntries, recoEntries, buildSchedule, MAX_ITEMS } from '../../web/js/schedule.js';
test('steps: the phone sensor gives the total; incidental steps count at 70 % on top of the workouts', () => {
  const day = { t: 1, steps: 6000, quality: 7000, brisk: 6000, longestM: 5000, activeMin: 40 };
  assert.deepEqual(blendDay(day, NaN), day, 'no sensor: unchanged'); assert.deepEqual(blendDay(day, 0), day);
  const b = blendDay(day, 10000); assert.equal(b.steps, 10000); assert.equal(b.quality, 7000 + Math.round(4000 * 0.7)); assert.equal(b.sensor, true);
  assert.equal(blendDay(day, 3000).steps, 6000, 'never below the tracked workouts');
  const s = stepSeries([wk(0, 5, 40)], 3, NOW, 170, { '2026-11-12': 9000, '__proto__': 5 }); assert.equal(s[2].sensor, true); assert.ok(s[2].steps >= 9000); assert.equal(s[1].sensor, undefined);
});
test('schedule: fixed reminders expand over the next days, sorted and bounded; recommendations 30 minutes before the usual window', () => {
  const txt = (kind) => ({ title: kind, body: 'b' }), rems = [{ id: 'a', kind: 'walk', time: '18:00', days: [4, 5], on: true }, { id: 'b', kind: 'move', time: '09:00', days: [0, 1, 2, 3, 4, 5, 6], on: false }];
  const f = reminderEntries(rems, NOW, txt); // NOW = Thursday 12 Nov 2026 10:00
  assert.deepEqual(f.map((e) => new Date(e.at).getDay()), [4, 5, 4].slice(0, f.length)); assert.equal(f.length, 3, 'Thu 18:00, Fri 18:00, next Thu 18:00 within 8 days'); assert.ok(f.every((e) => e.at > NOW && e.href === '#/workout/walk'));
  assert.equal(new Set(f.map((e) => e.id)).size, 3);
  const r = recoEntries([{ type: 'habit', day: 0, start: 17, end: 18, comfort: 80, params: { temp: 21 } }, { type: 'habit', day: 0, start: 7, end: 8, comfort: 80, params: {} }, { type: 'best', day: 0, start: 12, end: 13, comfort: 90, params: {} }, { type: 'habit', day: 1, start: 7, end: 8, comfort: 40, params: {} }], NOW, () => ({ title: 't', body: 'b' }));
  assert.equal(r.length, 1, 'only habit windows still ahead with good weather'); assert.equal(new Date(r[0].at).getHours(), 16); assert.equal(new Date(r[0].at).getMinutes(), 30);
  const mk = (n, base) => Array.from({ length: n }, (_, i) => ({ id: `${base}${i}`, at: 1e12 + i, title: 't', body: 'b', href: '' })), many = buildSchedule(mk(200, 'a'), mk(200, 'b'), mk(200, 'c')); assert.equal(many.length, MAX_ITEMS); assert.ok(many[0].at <= many[1].at);
  assert.ok(['a', 'b', 'c'].every((k) => many.some((e) => e.id.startsWith(k))), 'each source keeps a share');
});

import { widgetSnapshot } from '../../web/js/widgetData.js';
test('widget snapshot: rounded goals, translated texts, kind limited to walk/run', () => {
  const t = (k) => `T:${k}`, s = widgetSnapshot({ goalSteps: 7999.6, status: { done: 119.6, plan: { minutes: 180.2 }, status: 'on' }, kind: '../x' }, t);
  assert.deepEqual(s, { stepsGoal: 8000, effortDone: 120, effortPlan: 180, kind: 'walk', stepsTitle: 'T:wSteps', effortTitle: 'T:wEffort', effortSub: 'T:effOn', quickTitle: 'T:qaMeasure', quickHint: 'T:walk' });
  assert.equal(widgetSnapshot({ goalSteps: -5, status: { done: 0, plan: { minutes: 30 }, status: 'behind' }, kind: 'run' }, t).stepsGoal, 0);
});
