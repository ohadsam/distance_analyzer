import test from 'node:test';
import assert from 'node:assert/strict';
import { references, indicators } from '../../web/js/indicators.js';

const wk = (km, kind = 'run', splitsMs = [], extra = {}) => ({ kind, distanceM: km * 1000, movingMs: km * 330000, splits: splitsMs.reduce((a, ms, i) => [...a, { km: i + 1, atMs: (a[i - 1]?.atMs || 0) + ms }], []), ...extra });

test('references: last, longest and fastest kilometre of the same kind only', () => {
  const rows = [wk(4, 'run', [340000, 330000]), wk(9, 'walk'), wk(8, 'run', [360000, 300000, 350000]), wk(0.1, 'run')];
  const r = references(rows, 'run'); assert.equal(r.last.distanceM, 4000); assert.equal(r.longest.distanceM, 8000); assert.equal(r.bestKmMs, 300000);
  assert.equal(references([], 'run').last, null);
});
test('almost at the last distance, then passed it; each indication once', () => {
  const refs = references([wk(5), wk(5)], 'run'), fired = new Set();
  assert.deepEqual(indicators({ distM: 3000, splits: [] }, refs, fired), []);
  const a = indicators({ distM: 4800, splits: [] }, refs, fired); assert.equal(a.length, 1); assert.equal(a[0].key, 'indLastNear'); assert.equal(a[0].params.m, 200);
  assert.deepEqual(indicators({ distM: 4850, splits: [] }, refs, fired), [], 'not repeated');
  assert.equal(indicators({ distM: 5030, splits: [] }, refs, fired)[0].key, 'indRecPassed', 'the last distance is also the record: one message');
});
test('a longer personal record gets its own indications (not duplicated when it is the last workout)', () => {
  const refs = references([wk(5), wk(10)], 'run'), fired = new Set();
  assert.deepEqual(indicators({ distM: 5100, splits: [] }, refs, fired).map((x) => x.key), ['indLastPassed']);
  assert.deepEqual(indicators({ distM: 9800, splits: [] }, refs, fired).map((x) => x.key), ['indRecNear']);
  assert.deepEqual(indicators({ distM: 10050, splits: [] }, refs, fired).map((x) => x.key), ['indRecPassed']);
  const same = indicators({ distM: 4800, splits: [] }, references([wk(5)], 'run'), new Set()); assert.deepEqual(same.map((x) => x.key), ['indLastNear'], 'last == longest: one message');
});
test('kilometres: faster than last time by >= 3 s, your fastest ever, nothing when slower', () => {
  const refs = references([wk(5, 'run', [340000, 330000, 335000])], 'run'), fired = new Set();
  const faster = indicators({ distM: 1000, splits: [{ km: 1, atMs: 330000 }] }, refs, fired); assert.deepEqual(faster, [{ id: 'km-1-faster', key: 'indKmFaster', params: { k: 1, s: 10 } }]);
  assert.deepEqual(indicators({ distM: 2000, splits: [{ km: 1, atMs: 330000 }, { km: 2, atMs: 700000 }] }, refs, fired), [], 'km 2 took 370 s: slower, no message');
  const best = indicators({ distM: 3000, splits: [{ km: 1, atMs: 330000 }, { km: 2, atMs: 700000 }, { km: 3, atMs: 990000 }] }, refs, fired); assert.equal(best[0].key, 'indKmBest', '290 s < the best km (330 s)');
  assert.deepEqual(indicators({ distM: 1000, splits: [{ km: 1, atMs: 500000 }] }, references([], 'run'), new Set()), [], 'no history: no indications');
});

test('the remaining distance never reads "0 m"; a second call after the first reports nothing new', () => {
  const refs = { last: { distanceM: 5000, splits: [] }, longest: { distanceM: 9000 }, bestKmMs: 0 }, fired = new Set();
  const first = indicators({ distM: 4997, splits: [] }, refs, fired);
  assert.equal(first.find((e) => e.id === 'lastNear').params.m, 10);
  assert.deepEqual(indicators({ distM: 4997, splits: [] }, refs, fired), []);
});

import { brokenRecords } from '../../web/js/records.js';
test('records: distance, average pace and fastest kilometre; nothing to beat on the first workout; other kinds ignored', () => {
  const sp = (n, ms) => Array.from({ length: n }, (_, i) => ({ km: i + 1, atMs: (i + 1) * ms }));
  const old = { kind: 'run', startedAt: 1, distanceM: 5000, movingMs: 5 * 330000, splits: sp(5, 330000) };
  assert.deepEqual(brokenRecords([], { kind: 'run', startedAt: 9, distanceM: 9000, movingMs: 9 * 300000, splits: sp(9, 300000) }), []);
  const r = brokenRecords([old], { kind: 'run', startedAt: 9, distanceM: 6000, movingMs: 6 * 300000, splits: sp(6, 300000) });
  assert.deepEqual(r.map((x) => x.id), ['distance', 'pace', 'km']); assert.equal(r[0].prev, 5000);
  assert.deepEqual(brokenRecords([old], { kind: 'run', startedAt: 9, distanceM: 5000, movingMs: 5 * 335000, splits: sp(5, 335000) }), [], 'slower and not longer: no record');
  assert.deepEqual(brokenRecords([old], { kind: 'walk', startedAt: 9, distanceM: 9000, movingMs: 9 * 600000, splits: sp(9, 600000) }), [], 'a walk has no earlier walks');
  assert.deepEqual(brokenRecords([old], { kind: 'run', startedAt: 9, distanceM: 800, movingMs: 200000, splits: [] }), [], 'under 1 km is never a record');
});
