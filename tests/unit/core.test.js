import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clamp, cleanText } from '../../web/js/util.js';
import { STR, resolveLang } from '../../web/js/i18n.js';

test('cleanText strips control/bidi characters and caps length; clamp bounds', () => {
  assert.equal(cleanText('  a\u0007b  ', 10), 'ab'); assert.equal(cleanText(null, 5), ''); assert.equal(cleanText('abcdef', 3), 'abc');
  assert.equal(clamp(5, 0, 3), 3); assert.equal(clamp(-1, 0, 3), 0);
});
test('Hebrew and English dictionaries have identical keys, no empty values and matching placeholders', () => {
  const en = Object.keys(STR.en), he = Object.keys(STR.he);
  assert.deepEqual(en.filter((k) => !he.includes(k)), []); assert.deepEqual(he.filter((k) => !en.includes(k)), []);
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of en) { assert.ok(STR.en[k].length && STR.he[k].length, k); assert.equal(ph(STR.en[k]), ph(STR.he[k]), `placeholders differ: ${k}`); }
});
test('language resolution', () => {
  assert.equal(resolveLang('auto', 'he-IL'), 'he'); assert.equal(resolveLang('auto', 'iw'), 'he'); assert.equal(resolveLang('auto', 'en-US'), 'en'); assert.equal(resolveLang('en', 'he'), 'en');
});
import { gaugeDeg } from '../../web/js/metrics.js';
test('gaugeDeg: needle from -120 (slow) to +120 (fast) for speed and pace, none for other numbers', () => {
  const run = (ps) => ({ recent: Array.from({ length: 12 }, (_, k) => [32 + k * (1 / 111195) * (1000 / ps), 34.8, 1e12 + k * 1000]) }); // a fix per second at that pace
  assert.equal(gaugeDeg('time', null), null); assert.equal(gaugeDeg('speed', null), -120); assert.equal(gaugeDeg('pace', null), -120);
  const slow = gaugeDeg('speed', run(500)), fast = gaugeDeg('speed', run(200)); assert.ok(slow >= -120 && fast <= 120); assert.ok(fast > slow, `${slow} ${fast}`);
  const pf = gaugeDeg('pace', run(200)), ps = gaugeDeg('pace', run(500)); assert.ok(pf > ps, 'faster pace = further right');
});
