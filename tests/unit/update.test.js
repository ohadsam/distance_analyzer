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
  assert.equal(bannerName({ tempC: 5, cond: 'clear' }), 'cold'); assert.equal(bannerName({ tempC: 30, cond: 'clear' }), 'hot'); assert.equal(bannerName({ tempC: 20, cond: 'rain' }), 'rain'); assert.equal(bannerName({ tempC: 15, cond: 'clear' }), 'clear');
  assert.equal(bannerName({ tempC: 20, cond: 'windy' }), 'windy'); assert.equal(bannerName(null), null); assert.equal(bannerName({ tempC: NaN }), null);
  for (const n of ['clear', 'cloudy', 'rain', 'cold', 'hot', 'windy']) for (const m of ['light', 'dark']) assert.ok(existsSync(`web/art/weather/${n}-${m}.svg`), `${n}-${m}`);
  for (const n of ['almost-distance', 'passed-distance', 'almost-record', 'new-record', 'faster-last', 'fastest-km']) for (const m of ['light', 'dark']) assert.ok(existsSync(`web/art/badges/${n}-${m}.svg`), `${n}-${m}`);
  for (const n of ['welcome', 'no-workouts', 'no-routes', 'no-plan', 'caught-up', 'offline']) for (const m of ['light', 'dark']) assert.ok(existsSync(`web/art/onboarding/${n}-${m}.svg`), `${n}-${m}`);
  assert.equal(typeof badgeFor, 'function');
});

import { speak } from '../../web/js/voice.js';
test('spoken cues: sentences wait for each other, a backlog is dropped, the language is picked, nothing throws', () => {
  const said = []; let pending = false; const synth = { get pending() { return pending; }, cancel() { said.push('cancel'); pending = false; }, speak(u) { said.push(`${u.lang}:${u.text}`); } }; class U { constructor(t) { this.text = t; } }
  assert.equal(speak('Kilometre 3', 'en', synth, U), true); assert.equal(speak('New record', 'en', synth, U), true); pending = true; assert.equal(speak('קילומטר', 'he', synth, U), true);
  assert.deepEqual(said, ['en-US:Kilometre 3', 'en-US:New record', 'cancel', 'he-IL:קילומטר']);
  assert.equal(speak('x', 'en', undefined, U), false); assert.equal(speak('  ', 'en', synth, U), false); assert.equal(speak('x', 'en', { speak() { throw new Error('no'); } }, U), false);
});

import { parseBackup, collectPrefs, MAX_BACKUP_CHARS } from '../../web/js/backup.js';
test('backup files are untrusted: wrong format, huge or hostile content never gets through', () => {
  assert.equal(parseBackup('not json').error, 'format'); assert.equal(parseBackup('{"format":"x","v":1}').error, 'format'); assert.equal(parseBackup('x'.repeat(MAX_BACKUP_CHARS + 1)).error, 'size'); assert.equal(parseBackup(5).error, 'size');
  const p = parseBackup(JSON.stringify({ format: 'stepup-backup', v: 1, workouts: [{ evil: '<script>' }, null, 7], routes: 'x', prefs: { age: '40', 'bad key': 'x', loc: '{"lat":1}', active: '{}', big: 'x'.repeat(20001), n: 5 } }));
  assert.deepEqual(p.workouts, []); assert.deepEqual(p.routes, []); assert.deepEqual(p.prefs, { age: '40' });
  const store = new Map([['da.age', '30'], ['da.loc', 'x'], ['da.active', '{}'], ['other', '1'], ['da.pack', 'ocean']]); const st = { get length() { return store.size; }, key: (i) => [...store.keys()][i], getItem: (k) => store.get(k) };
  assert.deepEqual(collectPrefs(st), { age: '30', pack: 'ocean' });
});

test('the workout kit pictures the app uses all exist in light and dark', () => {
  const names = [...['morning', 'afternoon', 'evening', 'night'].map((n) => `banner-${n}`), ...['forest', 'sunrise', 'ocean'].map((n) => `card-${n}`), ...['1', '2', '3', '4', '5', 'go'].map((n) => `count-${n}`), ...['double-tap', 'volume-keys'].map((n) => `hint-${n}`)];
  for (const n of names) for (const m of ['light', 'dark']) assert.ok(existsSync(`web/art/workout/${n}-${m}.svg`), `${n}-${m}`);
});
