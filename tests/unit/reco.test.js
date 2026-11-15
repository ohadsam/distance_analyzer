import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastUrl, normalizeForecast, sanitizeHours, roundCoord, validCoords } from '../../web/js/forecast.js';
import { comfort, routineProfile, recommend, generalRecs } from '../../web/js/reco.js';

const NOW = new Date(2026, 6, 15, 5, 30).getTime(); // Wednesday 15 July 2026, 05:30 (a hot-summer day)
// a hot day: 24 deg at dawn, 38 at 15:00, 28 at night; daylight 6-19
const feelsAt = (h) => Math.round(24 + 14 * Math.exp(-((h - 15) ** 2) / 18));
const hotDay = (over = {}) => Array.from({ length: 48 }, (_, i) => { const t = new Date(2026, 6, 15, i, 0).getTime(), h = i % 24; return { t, temp: feelsAt(h) - 1, feels: feelsAt(h), rainP: 0, rain: 0, wind: 8, uv: h >= 10 && h <= 16 ? 9 : 2, day: h >= 6 && h < 19, ...over }; });
const run = (daysAgo, hour, kind = 'run', min = 35) => { const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 10, 0, 0); return { kind, startedAt: d.getTime(), distanceM: 5000, movingMs: min * 60000, elapsedMs: min * 61000, splits: [] }; };

test('forecast: URL has only rounded coordinates; hostile answers are normalised', () => {
  const u = forecastUrl(32.08123, 34.78987); assert.match(u, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=32\.08&longitude=34\.79&hourly=.*&timezone=GMT&timeformat=unixtime$/); assert.equal(roundCoord(34.78987), 34.79);
  assert.throws(() => forecastUrl(95, 0)); assert.throws(() => forecastUrl(NaN, 0)); assert.equal(validCoords(1, 200), false);
  const f = normalizeForecast({ hourly: { time: [1784084400, 'garbage', 1784088000], temperature_2m: [20, 21, 'x'], apparent_temperature: [22, 0, 0], precipitation_probability: [500, 0, 0], precipitation: [0, 0, 0], wind_speed_10m: [10, 0, 0], uv_index: [3, 0, 0], is_day: [1, 1, 1] } });
  assert.equal(f.length, 1); assert.equal(f[0].feels, 22); assert.equal(f[0].rainP, 100, 'clamped'); assert.equal(f[0].day, true);
  assert.deepEqual(normalizeForecast(null), []); assert.deepEqual(normalizeForecast({ hourly: { time: 'x' } }), []); assert.equal(normalizeForecast({ hourly: { time: new Array(500).fill(1784084400), temperature_2m: new Array(500).fill(20) } }).length, 72);
  assert.equal(f[0].t % 3600000, 0, 'aligned to the hour'); assert.deepEqual(sanitizeHours([{ t: 1.8e12, temp: 70, feels: 'x', rainP: 500, rain: 0, wind: 0, uv: 0, day: 1 }, { t: 5, temp: 1 }, null]), [{ t: 1.8e12, temp: 60, feels: 0, rainP: 100, rain: 0, wind: 0, uv: 0, day: false }]);
});
test('comfort: cool dry calm daylight is great; heat, rain, wind, darkness and UV reduce it, and the worst problem is named first', () => {
  const ok = { feels: 14, rainP: 0, rain: 0, wind: 6, uv: 2, day: true };
  assert.ok(comfort(ok, 'run').score >= 95); assert.deepEqual(comfort(ok, 'run').reasons, ['temp', 'dry', 'calm', 'daylight']);
  const hot = comfort({ ...ok, feels: 36, uv: 9 }, 'run'); assert.ok(hot.score < 35); assert.equal(hot.bad[0], 'heat');
  assert.ok(comfort({ ...ok, rainP: 80, rain: 2 }, 'walk').score < 60); assert.ok(comfort({ ...ok, wind: 45 }, 'walk').bad.includes('wind')); assert.ok(comfort({ ...ok, day: false }, 'walk').score <= 70);
  assert.ok(comfort({ ...ok, feels: 20 }, 'walk').score > comfort({ ...ok, feels: 20 }, 'run').score, 'a walker tolerates more warmth than a runner');
});
test('routine: finds the usual hours and the number of sessions per day from history', () => {
  const rows = []; for (let d = 1; d <= 40; d++) { rows.push(run(d, 7, 'walk', 30)); if (d % 2 === 0) rows.push(run(d, 18, 'walk', 30)); }
  const p = routineProfile(rows, NOW); assert.ok(p.n >= 40); assert.ok(p.habit(3, 7) > 0.8 && p.habit(3, 18) > 0.3 && p.habit(3, 12) < 0.1, `habit ${p.habit(3, 7)} ${p.habit(3, 12)}`);
  assert.ok(p.hours.includes(7)); assert.ok(p.sessions(3) >= 1 && p.sessions(3) <= 2); assert.equal(p.typicalMin('walk'), 30); assert.equal(p.typicalMin('run'), 35, 'default when none');
  const none = routineProfile([], NOW); assert.equal(none.n, 0); assert.equal(none.sessions(1), 1);
});
test('recommend: on a hot day the best windows are early/evening, the hot afternoon is to be avoided, with reasons', () => {
  const r = recommend(hotDay(), routineProfile([], NOW), 'run', NOW);
  const best = r.items.filter((i) => i.type === 'best'), avoid = r.items.filter((i) => i.type === 'avoid');
  assert.ok(best.length >= 1 && best.every((b) => b.start < 11 || b.start >= 18), JSON.stringify(best.map((b) => b.start)));
  assert.ok(avoid.length >= 1 && avoid[0].start >= 9 && avoid[0].start <= 12 && avoid[0].end > 16 && avoid[0].bad[0] === 'heat', JSON.stringify(avoid));
  assert.ok(best.every((b) => b.reasons.includes('daylight') || b.start >= 19), 'prefers daylight');
});
test('recommend: a person who walks at 7 and 18 gets habit windows at those hours when the weather allows', () => {
  const rows = []; for (let d = 1; d <= 40; d++) { rows.push(run(d, 7, 'walk', 30)); rows.push(run(d, 18, 'walk', 30)); }
  const day = hotDay().map((h) => ({ ...h, feels: Math.min(h.feels, 28), temp: Math.min(h.temp, 27) })); // not extreme
  const r = recommend(day, routineProfile(rows, NOW), 'walk', NOW), habit = r.items.filter((i) => i.type === 'habit' && i.day === 0);
  assert.ok(habit.length >= 2, JSON.stringify(r.items.map((i) => [i.type, i.start]))); assert.deepEqual(habit.map((h) => h.start).sort((a, b) => a - b).slice(0, 2).map((h) => Math.abs(h - 7) <= 1 || Math.abs(h - 18) <= 1), [true, true]);
});
test('recommend: when the usual hour is rainy the habit window moves to the best dry time; with no history the weather decides alone', () => {
  const rows = []; for (let d = 1; d <= 40; d++) rows.push(run(d, 7, 'walk', 30));
  const rainy = hotDay().map((h) => (new Date(h.t).getHours() >= 6 && new Date(h.t).getHours() <= 9 ? { ...h, rainP: 90, rain: 3 } : { ...h, feels: 22, temp: 21 }));
  const r = recommend(rainy, routineProfile(rows, NOW), 'walk', NOW); const first = r.items.find((i) => i.type !== 'avoid');
  assert.ok(first && (first.start < 6 || first.start >= 10), `moved to ${first?.start}`);
  const flat = recommend(hotDay().map((h) => ({ ...h, feels: 15, temp: 15 })), routineProfile([], NOW), 'walk', NOW); assert.ok(flat.items.some((i) => i.type === 'best'));
  assert.deepEqual(recommend([], routineProfile([], NOW), 'walk', NOW).items, []);
});
test('recommend: tomorrow is included on request and past hours are not', () => {
  const noon = new Date(2026, 6, 15, 12, 20).getTime(); const r = recommend(hotDay().map((h) => ({ ...h, feels: 16, temp: 16 })), routineProfile([], noon), 'walk', noon, { tomorrow: true });
  assert.ok(r.items.every((i) => i.day === 1 || i.start >= 12)); assert.ok(r.items.some((i) => i.day === 1));
});
test('generalRecs: behind the bar late in the week, ahead, heavy, low steps in the evening, restart and streak', () => {
  const st = (status, done, plan, share) => ({ plan: { minutes: plan }, done, share, status });
  const base = { steps: { today: 3000, goal: 8000 }, streak: 0, daysSinceLast: 0, hour: 10, weekday: 4 };
  const ids = (c) => generalRecs({ ...base, ...c }).map((r) => r.id);
  assert.ok(ids({ weekStatus: st('behind', 40, 180, 0.22) }).includes('effort-behind')); assert.equal(generalRecs({ ...base, weekStatus: st('behind', 40, 180, 0.22) })[0].params.per, 47);
  assert.ok(!ids({ weekStatus: st('behind', 40, 180, 0.22), weekday: 1 }).includes('effort-behind'), 'too early in the week');
  assert.ok(ids({ weekStatus: st('ahead', 200, 180, 1.1) }).includes('effort-ahead')); assert.ok(ids({ weekStatus: st('ahead', 260, 180, 1.44) }).includes('effort-heavy'));
  assert.ok(ids({ weekStatus: st('on', 90, 180, 0.5), hour: 17 }).includes('steps-low')); assert.ok(!ids({ weekStatus: st('on', 90, 180, 0.5), hour: 10 }).includes('steps-low'));
  assert.ok(ids({ weekStatus: st('on', 90, 180, 0.5), daysSinceLast: 4 }).includes('restart')); assert.ok(ids({ weekStatus: st('on', 90, 180, 0.5), streak: 5 }).includes('streak'));
});

test('regression: the walk/run choice changes the usual times (a person who runs at 6 and walks at 19)', () => {
  const rows = []; for (let d = 1; d <= 30; d++) { rows.push(run(d, 6, 'run', 35)); rows.push(run(d, 19, 'walk', 30)); }
  const walk = routineProfile(rows, NOW, 'walk'), runP = routineProfile(rows, NOW, 'run'), all = routineProfile(rows, NOW);
  assert.ok(walk.habit(3, 19) > 0.8 && walk.habit(3, 6) < 0.2, 'walk -> evening'); assert.ok(runP.habit(3, 6) > 0.8 && runP.habit(3, 19) < 0.2, 'run -> morning'); assert.ok(all.habit(3, 6) > 0.8 && all.habit(3, 19) > 0.8);
  assert.equal(routineProfile([run(1, 6, 'run', 30)], NOW, 'walk').n, 1, 'too few walks: falls back to all workouts');
});
test('regression: a habit window needs acceptable weather; an avoid stretch names the problem with the biggest total penalty', () => {
  const rows = []; for (let d = 1; d <= 40; d++) rows.push(run(d, 7, 'walk', 30));
  const awful = hotDay().map((h) => ({ ...h, feels: 38, temp: 38, wind: 30 }));
  const r = recommend(awful, routineProfile(rows, NOW, 'walk'), 'walk', NOW); assert.ok(!r.items.some((i) => i.type === 'habit'), 'no usual-time card in awful weather');
  const mixed = hotDay().map((h) => { const hr = new Date(h.t).getHours(); return hr >= 12 && hr <= 18 ? { ...h, feels: 38, temp: 37, wind: hr === 12 ? 45 : 8 } : { ...h, feels: 20, temp: 20 }; });
  const av = recommend(mixed, routineProfile([], NOW), 'walk', NOW).items.find((i) => i.type === 'avoid'); assert.ok(av); assert.equal(av.bad[0], 'heat');
});
