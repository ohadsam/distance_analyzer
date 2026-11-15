import test from 'node:test';
import assert from 'node:assert/strict';
import { cmpVersion, parseRelease, checkUpdate, shareApp, APK_URL, SITE_URL } from '../../web/js/update.js';

test('versions compare numerically; junk compares as 0.0.0', () => {
  assert.equal(cmpVersion('0.9.1', '0.10.0'), -1); assert.equal(cmpVersion('1.0.0', '0.99.99'), 1); assert.equal(cmpVersion('0.9.1', '0.9.1'), 0);
  assert.equal(cmpVersion('x', '0.0.0'), 0); assert.equal(cmpVersion('0.9.1', '<script>'), 1);
});
test('release JSON from GitHub is untrusted: only a version and short clean notes come out', () => {
  assert.deepEqual(parseRelease({ name: 'v0.9.2 (build 35)', body: 'a\nb' }), { version: '0.9.2', notes: 'a b' });
  assert.equal(parseRelease({ name: 'nightly' }), null); assert.equal(parseRelease(null), null); assert.equal(parseRelease({ name: 5 }), null);
  assert.equal(parseRelease({ name: 'v1.2.3', body: 'x'.repeat(5000) }).notes.length, 500);
});
test('the update check says latest / newer / error and never throws', async () => {
  const ok = (j) => async () => ({ ok: true, json: async () => j });
  assert.deepEqual(await checkUpdate('0.9.1', ok({ name: 'v0.9.1 (build 3)' })), { state: 'latest', version: '0.9.1' });
  assert.equal((await checkUpdate('0.9.1', ok({ name: 'v0.10.0 (build 9)', body: 'new' }))).state, 'newer');
  assert.equal((await checkUpdate('0.9.1', async () => ({ ok: false }))).state, 'error');
  assert.equal((await checkUpdate('0.9.1', async () => { throw new Error('offline'); })).state, 'error');
  assert.equal((await checkUpdate('0.9.1', ok({ name: '???' }))).state, 'error');
});
test('sharing prefers Android, then the browser share sheet, then the clipboard, then manual copy', async () => {
  const sent = []; const native = { available: true, share: (x) => { sent.push(x); return true; } };
  assert.equal(await shareApp('hi', { native }), 'shared'); assert.deepEqual(sent, ['hi']);
  assert.equal(await shareApp('hi', { native: { available: false }, nav: { share: async (o) => { sent.push(o.text); } } }), 'shared'); assert.equal(sent[1], 'hi'); assert.ok(SITE_URL.startsWith('https://'));
  assert.equal(await shareApp('hi', { nav: { share: async () => { throw Object.assign(new Error(), { name: 'AbortError' }); } } }), 'shared', 'cancelling is not a failure');
  let copied = ''; assert.equal(await shareApp('hi', { nav: { clipboard: { writeText: async (x) => { copied = x; } } } }), 'copied'); assert.equal(copied, 'hi');
  assert.equal(await shareApp('hi', { nav: {} }), 'manual');
  assert.match(APK_URL, /^https:\/\/github\.com\/ohadsam\/distance_analyzer\/releases\/latest\/download\/stepup\.apk$/);
});

import { bannerName, badgeFor } from '../../web/js/art.js';
import { existsSync } from 'node:fs';
test('weather banner picks a scene; every scene and badge file exists in light and dark', () => {
  assert.equal(bannerName({ tempC: 5, cond: 'clear' }), 'cold'); assert.equal(bannerName({ tempC: 30, cond: 'clear' }), 'hot'); assert.equal(bannerName({ tempC: 20, cond: 'rain' }), 'rain');
  assert.equal(bannerName({ tempC: 20, cond: 'windy' }), 'windy'); assert.equal(bannerName(null), null); assert.equal(bannerName({ tempC: NaN }), null);
  for (const n of ['clear', 'cloudy', 'rain', 'cold', 'hot', 'windy']) for (const m of ['light', 'dark']) assert.ok(existsSync(`web/art/weather/${n}-${m}.svg`), `${n}-${m}`);
  for (const n of ['almost-distance', 'passed-distance', 'almost-record', 'new-record', 'faster-last', 'fastest-km']) for (const m of ['light', 'dark']) assert.ok(existsSync(`web/art/badges/${n}-${m}.svg`), `${n}-${m}`);
  for (const n of ['welcome', 'no-workouts', 'no-routes', 'no-plan', 'caught-up', 'offline']) for (const m of ['light', 'dark']) assert.ok(existsSync(`web/art/onboarding/${n}-${m}.svg`), `${n}-${m}`);
  assert.equal(typeof badgeFor, 'function');
});
