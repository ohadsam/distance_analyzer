import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { IDS, SECONDS, sessionOf, totalSeconds, coolDownMinutes, isExercise } from '../../web/js/exercises.js';
import { ANIMATED, EXERCISE_ANIM } from '../../web/js/exerciseData.js';
import { STR } from '../../web/js/i18n.js';

test('every exercise has a name and how-to in both languages, and a sensible duration', () => {
  assert.equal(IDS.length, 24);
  for (const id of IDS) { for (const l of ['en', 'he']) { assert.ok(STR[l][`ex_${id}`] && STR[l][`exh_${id}`], `${id} ${l}`); assert.ok(STR[l][`exh_${id}`].length > 20); } assert.ok(SECONDS[id] >= 20 && SECONDS[id] <= 120); }
  assert.ok(isExercise('wu_march') && !isExercise('__proto__') && !isExercise('nope'));
});
test('sessions: warm-up and cool-down for a run and for a walk use only known exercises; the cool-down walk lasts what was recommended', () => {
  for (const s of ['warmup', 'cooldown']) for (const k of ['run', 'walk']) { const p = sessionOf(s, k); assert.ok(p.length >= 4); for (const e of p) assert.ok(isExercise(e.id), e.id); assert.equal(new Set(p.map((e) => e.id)).size, p.length); }
  assert.ok(sessionOf('warmup', 'run').every((e) => e.id.startsWith('wu_'))); assert.ok(sessionOf('cooldown', 'run').every((e) => e.id.startsWith('cd_')));
  assert.equal(sessionOf('cooldown', 'run', { walkMin: 7 })[0].seconds, 420); assert.equal(sessionOf('cooldown', 'run', { walkMin: 0 })[0].seconds, 120);
  const t = totalSeconds(sessionOf('warmup', 'run')); assert.ok(t >= 240 && t <= 420, `warm-up ${t}s`);
});
test('cool-down walk: by distance, longer after a hard run, none after a walk or a tiny run', () => {
  assert.equal(coolDownMinutes(1500, 'run'), 3); assert.equal(coolDownMinutes(4000, 'run'), 5); assert.equal(coolDownMinutes(8000, 'run'), 7); assert.equal(coolDownMinutes(12000, 'run'), 10); assert.equal(coolDownMinutes(21000, 'run'), 12);
  assert.equal(coolDownMinutes(4000, 'run', 280), 7, 'faster than 5:00/km over 3 km: +2'); assert.equal(coolDownMinutes(2000, 'run', 250), 5, 'under 3 km: no bonus'); assert.equal(coolDownMinutes(8000, 'walk'), 0); assert.equal(coolDownMinutes(300, 'run'), 0);
});
test('the list of animated exercises matches the files', () => {
  for (const id of ANIMATED) { assert.ok(isExercise(id), id); assert.ok(existsSync(`web/art/exercises/${id}.webp`), `web/art/exercises/${id}.webp`); } assert.equal(EXERCISE_ANIM.frames, 12);
});
