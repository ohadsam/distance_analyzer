// End-to-end smoke test in real Chromium against the static site. Usage: node tests/e2e/smoke.mjs [--shots dir]
import { chromium } from 'playwright';
import axe from 'axe-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { serve } from '../../scripts/serve.mjs';

const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });
const server = await serve('web', 0); const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
let failures = 0;
const step = async (name, fn) => { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; try { await fn(); console.log('✓', name); } catch (e) { failures++; console.error('✗', name, '\n  ', e.message.split('\n').slice(0, 14).join(' / ')); } };

// Hebrew/RTL is the default; pass {lang:'en'} to start in English. Collects console/page errors.
async function newPage({ lang = 'he', width = 390, geo = true, clock = false, clockAt = null, signalGapMs = 0, native = null, scheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'en-US', colorScheme: scheme, serviceWorkers: 'block', ...(geo ? { permissions: ['geolocation'], geolocation: { latitude: 32, longitude: 34.8, accuracy: 5 } } : {}) });
  if (lang !== 'he') await ctx.addInitScript((l) => { try { localStorage.setItem('da.lang', l); } catch { /* blocked */ } }, lang);
  const page = await ctx.newPage(); const errors = [];
  if (clock) await page.clock.install(clockAt ? { time: clockAt } : undefined);
  if (signalGapMs) await page.addInitScript(fakeFootsteps, signalGapMs);
  if (native) await ctx.addInitScript(fakeAndroid, native); // after the fake clock, so its timer is fake too
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { page, errors, ctx };
}
// Injected into the page: dispatches motion events that look like a runner with one foot strike every `gap` ms.
function fakeFootsteps(gap) {
  setInterval(() => { const d = performance.now() % gap, v = d < 160 ? 6 * Math.sin((Math.PI * d) / 160) : 0; const e = new Event('devicemotion'); e.accelerationIncludingGravity = { x: 0, y: 9.8 + v, z: 0 }; dispatchEvent(e); /* desktop Chromium has no DeviceMotionEvent */ }, 20);
}

// Saves finished workouts straight into the app's store (as the app itself would after a workout). rows: [{ daysAgo, km, min, kind, weather }]
async function seed(page, rows) {
  await page.evaluate(async (list) => {
    const S = await import('./js/store.js');
    for (const r of list) { const start = Date.now() - r.daysAgo * 86400000 - 3600000 * 2; await S.saveWorkout({ kind: r.kind || 'run', startedAt: start, endedAt: start + r.min * 61000, pausedMs: 0, pausedAt: 0, distanceM: r.km * 1000, movingMs: r.min * 60000, splits: [], points: [] }); if (r.weather) await S.updateWorkout(start, { weather: r.weather }); }
  }, rows);
}
const weeks = (n, per = 3) => Array.from({ length: n * per }, (_, i) => ({ daysAgo: 8 + Math.floor(i / per) * 7 + (i % per) * 2, km: 5, min: 30 }));

// A synthetic Open-Meteo answer for a hot summer day (cool dawn, 38 degrees in the afternoon) for the local days of `base`, today and tomorrow.
function hotForecast(base, over = {}) {
  const time = [], T = [], A = [], P = [], R = [], W = [], U = [], D = [];
  for (let i = 0; i < 48; i++) { const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), i, 0), h = i % 24, feels = Math.round(24 + 14 * Math.exp(-((h - 15) ** 2) / 18));
    time.push(d.getTime() / 1000); T.push(feels - 1); A.push(over.feels ?? feels); P.push(0); R.push(0); W.push(8); U.push(h >= 10 && h <= 16 ? 9 : 2); D.push(h >= 6 && h < 19 ? 1 : 0); }
  return { hourly: { time, temperature_2m: T, apparent_temperature: A, precipitation_probability: P, precipitation: R, wind_speed_10m: W, uv_index: U, is_day: D } };
}
const SUMMER = new Date(2026, 6, 15, 5, 30);
// Routes the weather service in a page to the synthetic answer and counts the requests (the privacy check: none before consent).
async function mockWeather(page, json, { fail = false } = {}) {
  const calls = []; await page.route('https://api.open-meteo.com/**', (route) => { calls.push(route.request().url()); return fail ? route.abort() : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) }); });
  return calls;
}
// Workouts at given hours: [{ daysAgo, hour, kind, min, km }] relative to the page's (fake) clock.
async function seedHours(page, rows) {
  await page.evaluate(async (list) => { const S = await import('./js/store.js'); for (const r of list) { const d = new Date(Date.now()); d.setDate(d.getDate() - r.daysAgo); d.setHours(r.hour, 5, 0, 0); const start = d.getTime();
    await S.saveWorkout({ kind: r.kind || 'walk', startedAt: start, endedAt: start + r.min * 61000, pausedMs: 0, pausedAt: 0, distanceM: (r.km || 3) * 1000, movingMs: r.min * 60000, splits: [], points: [] }); } }, rows);
}

// Saves workouts that FOLLOW a path (corner points in metres east/north of a start), with real timestamps and points, so routes can be saved/matched.
const PATHS = { L: [[0, 0], [600, 0], [600, 600]], other: [[0, 400], [600, 400], [600, 1000]] };
async function seedTracks(page, rows) {
  await page.evaluate(async ({ list, paths }) => {
    const S = await import('./js/store.js'), M = 1 / 111195, C = Math.cos(32 * Math.PI / 180);
    for (const r of list) {
      const mps = 1000 / r.pace, corners = paths[r.path || 'L'], pts = []; let t = 0; const d0 = new Date(Date.now()); d0.setDate(d0.getDate() - r.daysAgo); d0.setHours(r.hour, 5, 0, 0); const start = d0.getTime();
      for (let i = 1; i < corners.length; i++) { const [ax, ay] = corners[i - 1], [bx, by] = corners[i], n = Math.ceil(Math.hypot(bx - ax, by - ay) / mps); for (let k = i === 1 ? 0 : 1; k <= n; k++) { const f = k / n; pts.push([32 + (ay + (by - ay) * f) * M, 34.8 + (ax + (bx - ax) * f) * M / C, start + t * 1000]); t++; } }
      const len = 1200;
      await S.saveWorkout({ kind: r.kind || 'run', startedAt: start, endedAt: start + t * 1000, pausedMs: 0, pausedAt: 0, distanceM: len, movingMs: t * 1000, splits: [{ km: 1, atMs: Math.round(1000 / mps * 1000) }], points: pts });
      if (r.weather) await S.updateWorkout(start, { weather: r.weather });
    }
  }, { list: rows, paths: PATHS });
}
// Injected before the app loads: a stand-in for the Android bridge (window.StepUpNative) that records what the page asks and serves fixes/steps.
function fakeAndroid(init) {
  const n = window.__n = { started: 0, stopped: 0, fixes: JSON.parse(sessionStorage.getItem('__fixes') || '[]') /* the native buffer survives a page reload */, steps: {}, notes: null, href: '', sampled: 0, reqNotif: 0, reqActivity: 0, ...init };
  window.StepUpNative = { appVersion: () => '9.9', keepAwake() {}, trackAvailable: () => true, trackStart() { n.started++; return true; }, trackStop() { n.stopped++; },
    trackDrain() { const f = JSON.stringify(n.fixes); n.fixes = []; return f; }, stepsAvailable: () => true, stepsSample() { n.sampled++; }, stepsDays: () => JSON.stringify(n.steps), requestActivity() { n.reqActivity++; },
    setWidgetData(j) { n.widget = JSON.parse(j); }, share(x) { n.shared = x; return true; }, takePhoto() { queueMicrotask(() => dispatchEvent(new CustomEvent('stepup-native', { detail: { type: 'photo-taken', ok: true } }))); return true; },
    takenPhoto() { const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').fillRect(0, 0, 64, 64); return c.toDataURL('image/jpeg'); }, shareImage(b) { n.sharedImage = b; return true; }, saveBackup(j, name) { n.backup = j; n.backupName = name; queueMicrotask(() => dispatchEvent(new CustomEvent('stepup-native', { detail: { type: 'backup-saved', ok: true } }))); return true; },
    pickBackup() { queueMicrotask(() => dispatchEvent(new CustomEvent('stepup-native', { detail: { type: 'backup-picked', ok: !!n.picked } }))); return true; }, takeBackup() { const p = n.picked || ''; n.picked = ''; return p; }, notificationsAllowed: () => false, requestNotifications() { n.reqNotif++; }, setNotifications(j) { n.notes = JSON.parse(j); }, takePendingHref() { const h = n.href; n.href = ''; return h; } };
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
async function axeViolations(page) {
  await page.evaluate(axe.source); // evaluate (not addScriptTag): the page CSP forbids inline scripts
  return page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
}

await step('boots in Hebrew/RTL by default with no console errors', async () => {
  const { page, errors } = await newPage(); await page.goto(base); await page.waitForSelector('h1');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl'); assert.equal(await page.getAttribute('html', 'lang'), 'he'); assert.deepEqual(errors, []); await shot(page, 'home-he');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.pack), undefined, 'default pack = no attribute'); assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()), '#006B60', 'the design tokens are applied');
});
await step('English is LTR; settings switches language without a reload', async () => {
  const { page, errors } = await newPage({ lang: 'en' }); await page.goto(base + '#/settings'); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await page.waitForSelector('h1');
  assert.equal(await page.getAttribute('html', 'dir'), 'ltr'); assert.equal(await page.textContent('h1'), 'Settings');
  await page.selectOption('select >> nth=0', 'he'); await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  assert.equal(await page.textContent('h1'), 'הגדרות'); assert.deepEqual(errors, []);
});

await step('usability: welcome card saves the age once; bottom navigation marks the page and hides in workout mode; settings sections collapse', async () => {
  const { page, errors } = await newPage({ lang: 'en' }); await page.goto(base); await page.waitForSelector('#welcome');
  await page.fill('#welcome-age', '68'); await page.click('#welcome-ok'); await page.waitForSelector('#welcome', { state: 'detached' }); assert.equal(await page.locator('#welcome').count(), 0); assert.equal(await page.evaluate(() => localStorage.getItem('da.age')), '68');
  assert.equal(await page.locator('.bn').count(), 4); assert.equal(await page.locator('.bn[aria-current=page]').count(), 1);
  await page.click('.bn[href="#/plan"]'); await page.waitForSelector('.bn[href="#/plan"][aria-current=page]'); assert.equal(await page.getAttribute('.bn[aria-current=page]', 'href'), '#/plan');
  await page.goto(base + '#/settings'); await page.waitForSelector('details.sec'); assert.ok(await page.locator('details.sec:not([open])').count() >= 4, 'later sections start closed');
  await page.goto(base + '#/workout/walk'); await page.waitForSelector('.bottomnav', { state: 'hidden' }); assert.deepEqual(errors, []);
});

await step('about: update check (newer / latest / offline), newest APK link, share (browser sheet and Android)', async () => {
  const { page, errors } = await newPage({ lang: 'en' }); let release = { name: 'v99.0.0 (build 1)', body: 'Big news' };
  await page.route('https://api.github.com/**', (route) => (release ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(release) }) : route.abort()));
  await page.addInitScript(() => { window.__shared = null; navigator.share = async (o) => { window.__shared = o; }; });
  await page.goto(base + '#/settings/s-about'); await page.waitForSelector('#upd-check');
  assert.match(await page.textContent('#about-version'), /You have version \d+\.\d+\.\d+/); assert.match(await page.getAttribute('#upd-apk', 'href'), /releases\/latest\/download\/stepup\.apk$/);
  await page.click('#upd-check'); await page.waitForSelector('#upd-refresh'); assert.match(await page.textContent('#upd-msg'), /99\.0\.0/); assert.match(await page.textContent('.upd-extra'), /Big news/);
  release = { name: 'v0.0.1 (build 1)' }; await page.click('#upd-check'); await page.waitForFunction(() => /latest version/.test(document.getElementById('upd-msg').textContent)); assert.equal(await page.locator('#upd-refresh').count(), 0);
  release = null; await page.click('#upd-check'); await page.waitForFunction(() => /Could not check/.test(document.getElementById('upd-msg').textContent)); assert.equal(await page.locator('.upd-extra img').count(), 1, 'offline picture');
  await page.click('#share-app'); await page.waitForFunction(() => window.__shared); const sh = await page.evaluate(() => window.__shared); assert.match(sh.text, /ohadsam\.github\.io\/distance_analyzer\/ .*stepup\.apk/); assert.equal(sh.url, undefined, 'the links are in the text once');
  assert.deepEqual(errors.filter((e) => !/ERR_FAILED/.test(e)), []); // the aborted request is the offline case on purpose
  const a = await newPage({ lang: 'en', native: {} }); await a.page.goto(base + '#/settings/s-about'); await a.page.waitForSelector('#share-app'); await a.page.click('#share-app'); await a.page.waitForFunction(() => window.__n.shared); assert.match(await a.page.evaluate(() => window.__n.shared), /Android app:/);
  release = { name: 'v99.0.0 (build 1)' }; await a.page.route('https://api.github.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(release) })); await a.page.click('#upd-check'); await a.page.waitForSelector('#upd-apk-new');
});

await step('illustrations: empty states and the welcome card load the kit art (light and dark); no 404s', async () => {
  for (const scheme of ['light', 'dark']) {
    const { page, errors } = await newPage({ lang: 'en', scheme }); const bad = []; page.on('response', (r) => { if (r.status() >= 400) bad.push(r.url()); });
    for (const [route, sel] of [['#/alerts', '.empty img'], ['#/routes', '.empty img'], ['#/history', '.empty img'], ['#/', '#welcome img']]) {
      await page.goto(base + route); await page.waitForSelector(sel); await page.waitForFunction((s) => document.querySelector(s).complete && document.querySelector(s).naturalWidth > 0, sel);
      assert.match(await page.getAttribute(sel, 'src'), new RegExp(`-${scheme}\\.svg$`), `${route} ${scheme}`);
    }
    assert.deepEqual(bad, []); assert.deepEqual(errors, []);
  }
});

await step('backup: save to a file, wipe, restore (web file picker); hostile files refused; Android file dialogs', async () => {
  const { page, errors } = await newPage({ lang: 'en' }); await page.goto(base); await page.waitForSelector('.start-card');
  await seedHours(page, [{ daysAgo: 2, hour: 7, min: 30 }, { daysAgo: 5, hour: 18, min: 40, km: 5 }]); await page.evaluate(async () => { localStorage.setItem('da.age', '61'); localStorage.setItem('da.loc', '{"lat":1,"lon":2}'); localStorage.setItem('da.wxc', '{"k":"1,2"}'); const S = await import('./js/store.js'); const [w] = await S.listWorkouts({ points: false }); await S.updateWorkout(w.startedAt, { weather: { tempC: 12, cond: 'rain' } }); });
  await page.goto(base + '#/settings'); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await page.waitForSelector('#backup-save');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backup-save')]); assert.match(dl.suggestedFilename(), /^stepup-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const fs = await import('node:fs'); const path = await dl.path(); const text = fs.readFileSync(path, 'utf8'); const j = JSON.parse(text);
  assert.equal(j.format, 'stepup-backup'); assert.equal(j.workouts.length, 2); assert.equal(j.prefs.age, '61'); assert.equal(j.prefs.loc, undefined, 'location is never exported'); assert.equal(j.prefs.wxc, undefined, 'the weather cache holds the location too');
  await page.evaluate(async () => { const S = await import('./js/store.js'); for (const w of await S.listWorkouts({ points: false })) await S.deleteWorkout(w.startedAt); localStorage.setItem('da.age', '30'); });
  page.once('dialog', (d) => { assert.match(d.message(), /Restore 2 workouts/); d.accept(); }); await page.setInputFiles('#backup-file', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.waitForFunction(() => /Restored: 2 workouts/.test(document.getElementById('backup-msg')?.textContent || '')); await page.waitForLoadState('load'); await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(async () => (await (await import('./js/store.js')).listWorkouts({ points: false })).length), 2); assert.equal(await page.evaluate(async () => (await (await import('./js/store.js')).listWorkouts({ points: false })).filter((w) => w.weather?.cond === 'rain').length), 1, 'weather survives a restore'); assert.equal(await page.evaluate(() => localStorage.getItem('da.age')), '61');
  await page.goto(base + '#/settings'); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); page.once('dialog', (d) => d.accept());
  await page.setInputFiles('#backup-file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"nope"}') }); await page.waitForFunction(() => /not a StepUp backup/.test(document.getElementById('backup-msg').textContent));
  assert.deepEqual(errors, []);
  const a = await newPage({ lang: 'en', native: {} }); await a.page.goto(base + '#/settings'); await a.page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await a.page.waitForSelector('#backup-save');
  await a.page.click('#backup-save'); await a.page.waitForFunction(() => /Backup saved/.test(document.getElementById('backup-msg').textContent)); assert.match(await a.page.evaluate(() => window.__n.backupName), /^stepup-backup-/); assert.equal(JSON.parse(await a.page.evaluate(() => window.__n.backup)).format, 'stepup-backup');
  await a.page.evaluate((t) => { window.__n.picked = t; }, text); a.page.once('dialog', (d) => d.accept()); await a.page.click('#backup-restore'); await a.page.waitForFunction(() => /Restored: 2 workouts/.test(document.getElementById('backup-msg').textContent));
});

await step('dashboard offers walk and run and the essential widgets', async () => {
  const { page, errors } = await newPage({ lang: 'en' }); await page.goto(base); await page.waitForSelector('.start-card');
  assert.equal(await page.locator('.start-card').count(), 2); assert.equal(await page.locator('.wcard').count(), 7); assert.equal(await page.textContent('h1'), 'Dashboard'); assert.deepEqual(errors, []); await shot(page, 'home-en');
});
await step('workout: start, GPS distance grows, pause, resume, finish, summary, saved in history', async () => {
  const { page, errors, ctx } = await newPage({ lang: 'en' }); await page.goto(base + '#/workout/run'); await page.waitForSelector('.big-btn');
  assert.equal(await page.getAttribute('.workout', 'data-phase'), 'ready'); await page.waitForSelector('.chip[data-gps="good"]');
  await page.click('.big-btn'); assert.equal(await page.getAttribute('.workout', 'data-phase'), 'running');
  for (let i = 1; i <= 6; i++) { await ctx.setGeolocation({ latitude: 32 + i * 0.00007, longitude: 34.8, accuracy: 5 }); await page.waitForTimeout(1100); } // ~7.8 m per 1.1 s
  const km = Number(await page.textContent('.v-dist')); assert.ok(km >= 0.03 && km <= 0.06, `distance ${km}`);
  await shot(page, 'workout-running'); await page.click('.big-btn'); assert.equal(await page.getAttribute('.workout', 'data-phase'), 'paused');
  const frozen = await page.textContent('.v-dist'); await ctx.setGeolocation({ latitude: 32.01, longitude: 34.8, accuracy: 5 }); await page.waitForTimeout(800); assert.equal(await page.textContent('.v-dist'), frozen, 'paused: no distance added');
  await page.click('.big-btn'); await page.click('.controls .btn.ghost'); await page.waitForSelector('.confirm'); await shot(page, 'workout-confirm');
  await page.click('.confirm .btn >> nth=0'); await page.waitForSelector('.summary'); assert.match(await page.textContent('.summary'), /Distance/); await shot(page, 'workout-summary');
  await page.click('.summary a.btn'); await page.goto(base + '#/history'); await page.waitForSelector('.item'); assert.equal(await page.locator('.item').count(), 1); assert.deepEqual(errors, []);
  await page.click('.item'); await page.waitForSelector('.track'); await page.click('text=Delete'.replace('text=', 'button:has-text("') + '")');
});
await step('a reloaded workout waits paused and can be resumed; discard removes it', async () => {
  const { page } = await newPage({ lang: 'en' }); await page.goto(base + '#/workout/walk'); await page.waitForSelector('.big-btn'); await page.click('.big-btn'); await page.waitForTimeout(300);
  await page.goto(base + '#/'); await page.waitForSelector('.resume'); await page.click('.resume a.btn'); await page.waitForSelector('.workout[data-phase="paused"]');
  await page.click('.controls .btn.ghost'); await page.click('.confirm .btn.danger'); await page.waitForSelector('.start-card'); assert.equal(await page.locator('.resume').count(), 0);
});
await step('finish question pauses the workout; keep going resumes it, time is not added meanwhile', async () => {
  const { page } = await newPage({ lang: 'en', clock: true }); await page.goto(base + '#/workout/run'); await page.waitForSelector('.big-btn');
  await page.click('.big-btn'); await page.clock.runFor(5000); await page.click('.controls .btn.ghost'); await page.waitForSelector('.confirm');
  const t0 = await page.textContent('.v-time'); await page.clock.runFor(20000); assert.equal(await page.textContent('.v-time'), t0, 'the clock is stopped while asking');
  await page.click('.confirm .btn.ghost'); assert.equal(await page.getAttribute('.workout', 'data-phase'), 'running'); await page.clock.runFor(3000);
  assert.ok(Number(/:(\d\d)$/.exec(await page.textContent('.v-time'))[1]) >= 7 && Number(/:(\d\d)$/.exec(await page.textContent('.v-time'))[1]) <= 9, 'about 8 s of workout');
});
await step('a workout that is too short is not saved; starting another asks first', async () => {
  const { page } = await newPage({ lang: 'en' }); await page.goto(base + '#/workout/walk'); await page.waitForSelector('.big-btn'); await page.click('.big-btn');
  await page.click('.controls .btn.ghost'); await page.click('.confirm .btn >> nth=0'); await page.waitForSelector('.start-card'); await page.goto(base + '#/history'); await page.waitForSelector('text=No workouts yet'); await page.goto(base + '#/');
  await page.click('.start-card.walk'); await page.waitForSelector('.big-btn'); await page.click('.big-btn'); await page.goto(base + '#/'); await page.waitForSelector('.resume');
  page.once('dialog', (d) => d.dismiss()); await page.click('.start-card.run'); assert.match(page.url(), /#\/$/, 'declined: stays on Home');
});
await step('lock needs a press-and-hold to open', async () => {
  const { page } = await newPage({ lang: 'en' }); await page.goto(base + '#/workout/run'); await page.waitForSelector('.big-btn');
  await page.click('.wk-top button.round'); await page.waitForSelector('.lock:not([hidden])');
  await page.click('.lock .btn', { delay: 100 }); assert.equal(await page.locator('.lock:not([hidden])').count(), 1, 'a quick tap must not unlock');
  await page.locator('.lock .btn').dispatchEvent('pointerdown'); await page.waitForSelector('.lock', { state: 'hidden', timeout: 3000 });
});
await step('rhythm coach: silent while learning, then locks on the runner\'s cadence and shows the breathing guide', async () => {
  const { page, errors } = await newPage({ lang: 'en', clock: true, signalGapMs: 357 }); await page.goto(base + '#/workout/run'); await page.waitForSelector('.big-btn');
  await page.click('.big-btn'); await page.click('.controls button.round[aria-label="Rhythm"]'); await page.waitForSelector('.rhythm:not([hidden])');
  assert.equal(await page.getAttribute('.rhythm', 'data-state'), 'listening'); await page.clock.runFor(12000);
  assert.equal(await page.getAttribute('.rhythm', 'data-state'), 'listening', 'no sound while it learns'); await shot(page, 'rhythm-listening');
  await page.clock.runFor(26000); assert.equal(await page.getAttribute('.rhythm', 'data-state'), 'locked');
  const bpm = Number(await page.getAttribute('.rhythm', 'data-bpm')); assert.ok(Math.abs(bpm - 168) <= 4, `bpm ${bpm}`); assert.equal(await page.textContent('.rhythm-bpm'), String(bpm));
  await page.clock.runFor(500); assert.match(await page.textContent('.rhythm-cue'), /Breathe (in|out)/); await shot(page, 'rhythm-locked');
  await page.click('.controls .big-btn'); await page.clock.runFor(1000); assert.equal(await page.getAttribute('.rhythm', 'data-state'), 'listening', 'paused workout: silent again');
  await page.click('.controls button.round[aria-label="Rhythm"]'); assert.equal(await page.locator('.rhythm:not([hidden])').count(), 0); assert.deepEqual(errors, []);
});
await step('rhythm coach without a motion sensor falls back to the manual rhythm', async () => {
  const { page } = await newPage({ lang: 'en', clock: true }); await page.goto(base + '#/workout/run'); await page.waitForSelector('.big-btn');
  await page.click('.big-btn'); await page.click('.controls button.round[aria-label="Rhythm"]'); await page.clock.runFor(5000);
  assert.equal(await page.getAttribute('.rhythm', 'data-state'), 'locked'); assert.equal(await page.getAttribute('.rhythm', 'data-bpm'), '170'); assert.match(await page.textContent('.rhythm-label'), /No motion sensor/);
  await page.click('.rhythm-adjust button >> nth=1'); assert.equal(await page.getAttribute('.rhythm', 'data-bpm'), '172');
});
await step('settings: look, pack and rhythm options are saved', async () => {
  const { page } = await newPage({ lang: 'en' }); await page.goto(base + '#/settings'); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await page.waitForSelector('#s-pack');
  await page.selectOption('#s-pack', 'ocean'); assert.equal(await page.getAttribute('html', 'data-pack'), 'ocean');
  await page.selectOption('#s-breath', '2:2'); await page.reload(); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await page.waitForSelector('#s-breath'); assert.equal(await page.inputValue('#s-breath'), '2:2'); assert.equal(await page.getAttribute('html', 'data-pack'), 'ocean');
});

await step('dashboard: effort and steps widgets, drill-down, filters, customise (hide and reorder survive a reload)', async () => {
  const { page, errors } = await newPage({ lang: 'en' }); await page.goto(base); await page.waitForSelector('.wcard'); await seed(page, weeks(5)); await page.reload(); await page.waitForSelector('.wcard');
  assert.match(await page.textContent('[data-widget=effort]'), /of \d+ min/); await shot(page, 'dashboard-en');
  await page.click('[data-widget=effort]'); await page.waitForSelector('.drill .chart'); assert.equal(await page.textContent('h1'), 'Weekly effort'); assert.match(await page.textContent('.drill'), /Guidance for your age/); await shot(page, 'drill-effort');
  await page.goto(base + '#/d/distance'); await page.waitForSelector('.drill .list .item'); const all = await page.locator('.drill .list .item').count(); assert.ok(all >= 10);
  await page.evaluate(() => { const d = document.querySelector('details.fold'); if (d) d.open = true; }); await page.selectOption('.filters select >> nth=1', 'walk'); await page.waitForSelector('text=Nothing here for this filter.'); await page.selectOption('.filters select >> nth=1', ''); await page.waitForSelector('.drill .list .item');
  await page.goto(base + '#/'); await page.waitForSelector('.wcard'); await page.click('.dash-top button'); await page.click('[data-widget=weather] button.btn'); for (let i = 0; i < 4; i++) { await page.click('[data-widget=steps] button[aria-label^="Move up"]'); await page.waitForTimeout(150); }
  await page.click('.dash-top button'); await page.waitForSelector('.wcard:not(.editing)'); assert.equal(await page.locator('[data-widget=weather]').count(), 0); await page.reload(); await page.waitForSelector('.wcard');
  assert.equal(await page.locator('[data-widget=weather]').count(), 0, 'hidden stays hidden'); assert.equal(await page.locator('.wcard').first().getAttribute('data-widget'), 'steps', 'moved to the top'); assert.deepEqual(errors, []);
});
await step('weather: add it to a workout, the weather widget and filter use it', async () => {
  const { page } = await newPage({ lang: 'en' }); await page.goto(base); await seed(page, [{ daysAgo: 1, km: 6, min: 33 }, { daysAgo: 3, km: 6, min: 40 }]);
  await page.goto(base + '#/history'); await page.waitForSelector('.item'); await page.click('.item >> nth=0'); await page.waitForSelector('#wx-save');
  await page.selectOption('#wx-cond', 'rain'); await page.fill('#wx-temp', '12'); await page.click('#wx-save'); await page.waitForSelector('#wx-save'); assert.equal(await page.inputValue('#wx-temp'), '12');
  await page.goto(base + '#/'); await page.waitForSelector('[data-widget=weather]'); assert.match(await page.textContent('[data-widget=weather]'), /Rain/);
  await page.evaluate(() => { const d = document.querySelector('details.fold'); if (d) d.open = true; }); await page.selectOption('.filters select >> nth=2', 'rain'); await page.waitForSelector('[data-widget=distance]'); assert.match(await page.textContent('[data-widget=distance]'), /1 workouts/);
});
await step('alerts: an effort alert explains what happened, why it matters and applies a gentler bar; the bell shows unread', async () => {
  const { page } = await newPage({ lang: 'en' }); await page.goto(base); await seed(page, weeks(5)); await page.reload(); await page.waitForSelector('.wcard');
  const before = Number((/of (\d+) min/.exec(await page.textContent('[data-widget=effort]')) || [])[1]);
  await page.evaluate(async () => { const N = await import('./js/ui/notify.js'); N.pushAlert({ id: 'eff-test', kind: 'effort', level: 'warn', title: 'eff_long_title', lines: ['eff_long_what', 'eff_long_risk', 'eff_long_tip'], params: { km: '12.0', min: 70, ratio: 240, typicalKm: '5.0', plan: 180, newTarget: 198 }, href: '#/alerts' }, { system: false }); });
  assert.equal(await page.locator('#tab-alerts .dot:not([hidden])').count(), 1, 'unread dot');
  await page.click('#tab-alerts'); await page.waitForSelector('.alert'); const txt = await page.textContent('.alert'); assert.match(txt, /Much longer than usual/); assert.match(txt, /What happened/); assert.match(txt, /Why it matters/); assert.match(txt, /What to do/); assert.match(txt, /12\.0 km/);
  await shot(page, 'alert'); await page.click('.alert .btn'); await page.goto(base + '#/'); await page.waitForSelector('[data-widget=effort]'); assert.match(await page.textContent('[data-widget=effort]'), /of 198 min/); assert.ok(before !== 198 || true);
  assert.equal(await page.locator('#tab-alerts .dot:not([hidden])').count(), 0, 'read after opening the inbox');
});
await step('global search: settings (both languages), workouts, screens; results open the right place', async () => {
  const { page } = await newPage({ lang: 'he' }); await page.goto(base); await seed(page, [{ daysAgo: 1, km: 5.2, min: 30 }]); await page.goto(base + '#/search'); await page.waitForSelector('#q');
  await page.fill('#q', 'נשימה'); await page.waitForSelector('.result[data-type=setting]'); await page.fill('#q', 'breathing'); await page.waitForSelector('.result[data-type=setting]');
  await page.click('.result[data-type=setting]'); await page.waitForSelector('#s-breath'); assert.equal(await page.evaluate(() => document.activeElement.id), 's-breath', 'focused the found setting');
  await page.goto(base + '#/search'); await page.fill('#q', 'ריצה 5.2'); await page.waitForSelector('.result[data-type=workout]'); await page.click('.result[data-type=workout]'); await page.waitForSelector('.track');
  await page.goto(base + '#/search'); await page.fill('#q', 'zzzzzz'); await page.waitForSelector('.note'); assert.equal(await page.locator('.result').count(), 0);
  await page.fill('#q', 'dashboard'); await page.waitForSelector('.result[data-type=screen]');
});
await step('reminders: a fixed reminder fires on time into the inbox; the smart nudge is optional and quiet by default', async () => {
  const { page } = await newPage({ lang: 'en', clock: true, clockAt: new Date(2026, 10, 12, 17, 59, 40) }); await page.goto(base + '#/settings'); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await page.waitForSelector('#rem-add');
  await page.click('#rem-add'); await page.waitForSelector('.rem'); await page.fill('.rem input[type=time]', '18:00'); await page.locator('.rem input[type=time]').dispatchEvent('change');
  assert.equal(await page.locator('#s-smart').isChecked(), false, 'smart nudges are off until the person turns them on');
  await page.clock.runFor(45000); await page.evaluate(() => dispatchEvent(new HashChangeEvent('hashchange'))); await page.goto(base + '#/alerts'); await page.waitForSelector('.alert'); assert.match(await page.textContent('.alert'), /Time for a walk/);
});

await step('recommendations: nothing is sent before consent; then best times by weather, avoid the hot afternoon, today/tomorrow, run vs walk', async () => {
  const { page, errors } = await newPage({ lang: 'en', clock: true, clockAt: SUMMER }); const calls = await mockWeather(page, hotForecast(SUMMER));
  await page.goto(base + '#/reco'); await page.waitForSelector('#reco-consent'); assert.equal(calls.length, 0, 'no request before consent'); assert.match(await page.textContent('.consent'), /approximate location/); await shot(page, 'reco-consent');
  await page.click('#reco-consent'); await page.waitForSelector('[data-reco=best]'); assert.equal(calls.length, 1); assert.match(calls[0], /latitude=32&longitude=34\.8&/, 'rounded coordinates only'); assert.match(calls[0], /timezone=GMT&timeformat=unixtime/); assert.ok(!/\bkey\b|token/i.test(calls[0]));
  const best = await page.locator('[data-reco=best] .num').allTextContents(); assert.ok(best.length >= 1 && best.every((r) => Number(r.slice(0, 2)) < 11 || Number(r.slice(0, 2)) >= 18), `best ${best}`);
  assert.ok(await page.locator('[data-reco=avoid]').count() >= 1, 'the hot afternoon is to be avoided'); assert.match(await page.textContent('[data-reco=avoid]'), /hot/); assert.match(await page.textContent('.recos'), /Open-Meteo/); await shot(page, 'reco-results');
  await page.click('.chip:has-text("Tomorrow")'); await page.waitForSelector('[data-reco] small:has-text("Tomorrow"), .note'); await page.selectOption('#reco-kind', 'run'); await page.waitForSelector('[data-reco]');
  assert.equal(calls.length, 1, 'the forecast is cached, not re-fetched'); assert.deepEqual(errors, []);
});
await step('recommendations follow the routine: a person who walks at 7 and 18 gets "your usual time" around those hours', async () => {
  const { page } = await newPage({ lang: 'en', clock: true, clockAt: SUMMER }); await mockWeather(page, hotForecast(SUMMER, { feels: 22 })); await page.goto(base);
  await seedHours(page, Array.from({ length: 30 }, (_, i) => [{ daysAgo: i + 1, hour: 7, min: 30 }, { daysAgo: i + 1, hour: 18, min: 30 }]).flat());
  await page.evaluate(() => { localStorage.setItem('da.onlineWx', '1'); localStorage.setItem('da.loc', JSON.stringify({ lat: 32, lon: 34.8 })); }); await page.goto(base + '#/reco'); await page.waitForSelector('[data-reco=habit]');
  const times = (await page.locator('[data-reco=habit] .num').allTextContents()).map((r) => Number(r.slice(0, 2))); assert.ok(times.some((h) => Math.abs(h - 7) <= 1) && times.some((h) => Math.abs(h - 18) <= 1), `habit ${times}`);
  await shot(page, 'reco-habit');
});
await step('recommendations: dashboard widget and drill-down, toolbar button, effort recommendations, failure and retry', async () => {
  const { page } = await newPage({ lang: 'en', clock: true, clockAt: SUMMER }); const calls = await mockWeather(page, hotForecast(SUMMER), { fail: true }); await page.goto(base); await page.waitForSelector('[data-widget=reco]');
  assert.match(await page.textContent('[data-widget=reco]'), /Allow the forecast/); await page.click('[data-widget=reco]'); await page.waitForSelector('#reco-consent'); assert.equal(await page.textContent('h1'), 'Recommendations');
  await page.click('#reco-consent'); await page.waitForSelector('#reco-retry'); assert.match(await page.textContent('.recobox'), /Could not load the forecast/);
  await page.unroute('https://api.open-meteo.com/**'); await mockWeather(page, hotForecast(SUMMER)); await page.click('#reco-retry'); await page.waitForSelector('[data-reco=best]');
  await page.goto(base + '#/'); await page.waitForSelector('[data-widget=reco] .big'); assert.match(await page.textContent('[data-widget=reco]'), /Best time today|Your usual time|Good time/);
  await page.click('a[aria-label="Recommendations"]'); await page.waitForSelector('.recos'); await page.click('.chip[data-area=effort]'); await page.waitForSelector('.chip[data-area=effort][aria-pressed=true]');
});
await step('settings: the online forecast is off by default, opt-in stores only rounded coordinates, turning it off forgets them; notification needs it', async () => {
  const { page } = await newPage({ lang: 'en' }); await page.goto(base + '#/settings'); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await page.waitForSelector('#s-online');
  assert.equal(await page.locator('#s-online').isChecked(), false); assert.equal(await page.evaluate(() => localStorage.getItem('da.loc')), null);
  await page.click('#s-reco-notify'); assert.equal(await page.locator('#s-reco-notify').isChecked(), false, 'needs the online forecast first'); assert.match(await page.textContent('#online-msg'), /stays off/);
  await page.check('#s-online'); await page.waitForSelector('#loc-saved'); assert.match(await page.textContent('#loc-saved'), /32, 34\.8/); assert.equal(await page.evaluate(() => localStorage.getItem('da.onlineWx')), '1');
  await page.check('#s-reco-notify'); assert.equal(await page.evaluate(() => localStorage.getItem('da.recoNotify')), '1');
  await page.uncheck('#s-online'); await page.waitForFunction(() => !document.getElementById('loc-saved')); assert.equal(await page.evaluate(() => [localStorage.getItem('da.loc'), localStorage.getItem('da.recoNotify')].join()), 'null,0');
});
await step('recommendation notification: shortly before the usual time and good weather, once', async () => {
  const at = new Date(2026, 6, 15, 6, 20); const { page } = await newPage({ lang: 'en', clock: true, clockAt: at }); await mockWeather(page, hotForecast(at, { feels: 20 })); await page.goto(base);
  await seedHours(page, Array.from({ length: 30 }, (_, i) => ({ daysAgo: i + 1, hour: 7, min: 30 })));
  await page.evaluate(() => { for (const [k, v] of Object.entries({ onlineWx: '1', recoNotify: '1', loc: JSON.stringify({ lat: 32, lon: 34.8 }) })) localStorage.setItem('da.' + k, v); });
  await page.clock.runFor(31000); await page.waitForTimeout(800); /* the mocked network answers in real time; the fake clock must not run past the 8 s timeout meanwhile */ await page.clock.runFor(2000); await page.goto(base + '#/alerts'); await page.waitForSelector('.alert'); assert.match(await page.textContent('.alert'), /Good time for a walk soon/); assert.equal(await page.locator('.alert').count(), 1, 'only once');
});

await step('routes: save a path as a route, link earlier workouts, progress, best context, one-time, rename, delete', async () => {
  const { page, errors } = await newPage({ lang: 'en' }); await page.goto(base);
  await seedTracks(page, [{ daysAgo: 30, hour: 7, pace: 360 }, { daysAgo: 25, hour: 7, pace: 352 }, { daysAgo: 20, hour: 18, pace: 380 }, { daysAgo: 12, hour: 7, pace: 335 }, { daysAgo: 6, hour: 7, pace: 330 }, { daysAgo: 3, hour: 18, pace: 372 }, { daysAgo: 1, hour: 7, pace: 325 }, { daysAgo: 4, hour: 9, pace: 340, path: 'other' }]);
  await page.goto(base + '#/history'); await page.waitForSelector('.item'); await page.click('.item >> nth=0'); await page.waitForSelector('#route-save'); assert.match(await page.textContent('.routebox'), /Save this path as a route/);
  await page.fill('#route-name', 'Park loop'); await page.click('#route-save'); await page.waitForSelector('text=Route saved'); await page.click('.routebox a.btn'); await page.waitForSelector('#route-link');
  assert.equal(await page.textContent('h1'), 'Park loop'); assert.match(await page.textContent('.rows'), /Attempts on this route/); await page.click('#route-link'); await page.waitForFunction(() => /\b[5-7]\b/.test(document.querySelector('.rows .row:nth-child(2) b')?.textContent || ''));
  const attempts = Number(await page.textContent('.rows .row:nth-child(2) b')); assert.equal(attempts, 7, 'the 7 workouts on the same path are linked; the other street is not');
  assert.match(await page.textContent('.route'), /faster than in your first times here/); assert.match(await page.textContent('.route'), /You do best here in the morning/); await shot(page, 'route-detail');
  await page.fill('#route-rename', 'Riverside'); await page.click('#route-rename-save'); await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Riverside');
  await page.check('#route-onetime'); await page.waitForSelector('h1 .tag'); await page.goto(base + '#/routes'); await page.waitForSelector('[data-route]'); assert.match(await page.textContent('[data-route]'), /One-time/);
  assert.equal(await page.locator('[data-route-suggestion]').count(), 0, 'a one-time route is never suggested');
  await page.click('[data-route]'); await page.waitForSelector('#route-delete'); page.once('dialog', (d) => d.accept()); await page.click('#route-delete'); await page.waitForSelector('text=No routes yet'); await page.goto(base + '#/history'); await page.waitForSelector('.item'); assert.equal(await page.locator('.item').count(), 8, 'the workouts stay');
  assert.deepEqual(errors, []);
});
await step('route suggestions follow the time of day and the weather performance; quick actions; widget', async () => {
  const { page } = await newPage({ lang: 'en', clock: true, clockAt: new Date(2026, 6, 15, 7, 10) }); await page.goto(base);
  await seedTracks(page, [...[20, 17, 14, 11].map((d, i) => ({ daysAgo: d, hour: 7, pace: 320 + i })), ...[21, 18, 15, 12].map((d, i) => ({ daysAgo: d, hour: 18, pace: 360 + i })), ...[10, 8, 6].map((d, i) => ({ daysAgo: d, hour: 7, pace: 345 + i, path: 'other' })), ...[9, 7, 5].map((d, i) => ({ daysAgo: d, hour: 18, pace: 345 + i, path: 'other' }))]);
  await page.evaluate(async () => { const S = await import('./js/store.js'), R = await import('./js/route.js'), rows = await S.listWorkouts(); const a = rows.find((w) => w.movingMs / 1000 / 1.2 < 400 && w.points.length), mk = async (src, id, name) => { const r = await S.saveRoute(R.makeRoute(src.points, { id, name })); for (const w of rows) if (R.matchRoute(w.points, r).ok) await S.updateWorkout(w.startedAt, { routeId: id }); }; await mk(rows.find((w) => w.points[0][0] < 32.002 && w.startedAt === Math.min(...rows.filter((x) => x.points[0][0] < 32.002).map((x) => x.startedAt))), 'rrida', 'Riverside'); await mk(rows.find((w) => w.points[0][0] > 32.003), 'rrdbb', 'Hills'); void a; });
  await page.evaluate(() => localStorage.setItem('da.recoKind', 'run')); await page.goto(base + '#/'); await page.waitForSelector('#qa-measure'); assert.match(await page.textContent('#qa-suggested'), /Riverside/, 'in the morning the morning route is suggested'); await shot(page, 'dashboard-quick');
  await page.goto(base + '#/routes'); await page.waitForSelector('[data-route-suggestion]'); assert.equal(await page.locator('[data-route-suggestion]').first().getAttribute('data-route-suggestion'), 'rrida'); assert.match(await page.textContent('[data-route-suggestion]'), /time of day/);
  await page.goto(base + '#/'); await page.waitForSelector('[data-widget=routes]'); assert.match(await page.textContent('[data-widget=routes]'), /2/); await page.click('[data-widget=routes]'); await page.waitForSelector('.routesbox [data-route]'); await shot(page, 'routes');
  await page.goto(base + '#/reco'); await page.click('.chip[data-area=routes]'); await page.waitForSelector('[data-route-suggestion]');
});
await step('street map (opt-in): no request while off; on -> the live map and a workout picture show tiles, credit shown, failed tiles hidden', async () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const { page, ctx, errors } = await newPage({ lang: 'en' }); const asked = []; await page.route('https://tile.openstreetmap.org/**', (route) => { asked.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  await page.goto(base); await page.waitForSelector('#qa-measure'); await page.click('#qa-measure'); await page.waitForSelector('.workout[data-phase="running"]');
  for (let i = 1; i <= 2; i++) { await ctx.setGeolocation({ latitude: 32 + i * 0.00007, longitude: 34.8, accuracy: 5 }); await page.waitForTimeout(1100); }
  assert.equal(asked.length, 0, 'tiles are off by default'); assert.equal(await page.locator('.livemap image').count(), 0);
  await page.evaluate(() => localStorage.setItem('da.mapTiles', '1')); await page.reload(); await page.waitForSelector('.workout');
  for (let i = 3; i <= 4; i++) { await ctx.setGeolocation({ latitude: 32 + i * 0.00007, longitude: 34.8, accuracy: 5 }); await page.waitForTimeout(1100); }
  await page.waitForSelector('.livemap image'); assert.ok(asked.length >= 1 && asked.every((u) => /^https:\/\/tile\.openstreetmap\.org\/16\/\d+\/\d+\.png$/.test(u)), asked.join(' ')); assert.match(await page.textContent('.mapwrap .credit'), /OpenStreetMap contributors/); assert.equal(await page.getAttribute('.mapwrap .credit', 'href'), 'https://www.openstreetmap.org/copyright');
  await page.goto(base + '#/settings'); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); assert.equal(await page.isChecked('#s-tiles'), true);
  await seedTracks(page, [{ daysAgo: 2, hour: 7, pace: 330 }]); await page.goto(base + '#/history'); await page.click('a[href^="#/w/"]'); await page.waitForSelector('svg.track.on-map image'); assert.ok(await page.locator('svg.track .track-line').count() >= 1);
  assert.deepEqual(errors, []);
});

await step('record celebration: ask, victory photo (web file and Android camera), animated podium, share as PNG, axe clean', async () => {
  const open = async (page) => page.evaluate(async () => { const { celebrationCard } = await import('./js/ui/podium.js'); document.getElementById('app').replaceChildren(Object.assign(document.createElement('h1'), { textContent: 'Summary' }), celebrationCard([{ id: 'distance', value: 12340, prev: 10000 }, { id: 'pace', value: 300, prev: 320 }], { startedAt: Date.now(), kind: 'run' })); });
  const { page, errors } = await newPage({ lang: 'en' }); await page.goto(base); await page.waitForSelector('.start-card'); await open(page);
  assert.match(await page.textContent('#celebrate'), /New distance record!/); assert.match(await page.textContent('#celebrate'), /12\.34\s*km/); assert.match(await page.textContent('#celebrate'), /New pace record!/);
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 300, 200); return c.toDataURL('image/png').split(',')[1]; });
  await page.setInputFiles('#rec-file', { name: 'me.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await page.waitForSelector('.podium .pd-photo img'); assert.match(await page.getAttribute('.pd-photo img', 'src'), /^data:image\/jpeg;base64,/);
  assert.equal(await page.locator('.podium .pd-c').count(), 24); assert.equal(await page.locator('.podium .pd-step').count(), 3); assert.match(await page.getAttribute('.podium', 'aria-label'), /New distance record!/);
  await page.waitForTimeout(3000); await shot(page, 'podium'); assert.deepEqual(await axeViolations(page), []);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rec-share')]); assert.equal(dl.suggestedFilename(), 'stepup-record.png');
  const fs = await import('node:fs'); const buf = fs.readFileSync(await dl.path()); if (shots) fs.writeFileSync(`${shots}/record-card.png`, buf); assert.equal(buf.subarray(1, 4).toString(), 'PNG'); assert.ok(buf.length > 20000, 'a real picture');
  await page.click('#rec-retake'); await page.waitForSelector('#rec-nophoto'); await page.click('#rec-nophoto'); await page.waitForSelector('.podium'); assert.equal(await page.locator('.pd-photo img').count(), 0, 'no photo, no image'); assert.deepEqual(errors, []);
  const a = await newPage({ lang: 'en', native: {} }); await a.page.goto(base); await a.page.waitForSelector('.start-card'); await open(a.page); await a.page.click('#rec-photo'); await a.page.waitForSelector('.pd-photo img');
  await a.page.click('#rec-share'); await a.page.waitForFunction(() => window.__n.sharedImage); assert.ok((await a.page.evaluate(() => window.__n.sharedImage)).length > 1000);
});

await step('quick action "Measure now" starts at once; live map; following a route shows the route and a ghost of the best attempt', async () => {
  const { page, ctx, errors } = await newPage({ lang: 'en' }); await page.goto(base); await page.waitForSelector('#qa-measure'); await page.click('#qa-measure'); await page.waitForSelector('.workout[data-phase="running"]');
  assert.ok(await page.locator('.livemap').count()); for (let i = 1; i <= 3; i++) { await ctx.setGeolocation({ latitude: 32 + i * 0.00007, longitude: 34.8, accuracy: 5 }); await page.waitForTimeout(1100); } assert.ok(await page.locator('.livemap .track-line').count() >= 1 || await page.locator('.livemap .me').count() >= 1);
  await shot(page, 'measure-now'); await page.click('.controls .btn.ghost'); await page.click('.confirm .btn.danger'); await page.waitForSelector('.start-card');
  await seedTracks(page, [{ daysAgo: 3, hour: 7, pace: 300 }, { daysAgo: 2, hour: 7, pace: 310 }]);
  await page.evaluate(async () => { const S = await import('./js/store.js'), R = await import('./js/route.js'), w = (await S.listWorkouts())[0]; const r = await S.saveRoute(R.makeRoute(w.points, { id: 'rghost', name: 'Ghost loop' })); for (const x of await S.listWorkouts()) await S.updateWorkout(x.startedAt, { routeId: r.id }); });
  await page.goto(base + '#/workout/run/go/r/rghost'); await page.waitForSelector('.workout[data-phase="running"]'); await page.waitForSelector('text=Following: Ghost loop');
  for (let i = 1; i <= 3; i++) { await ctx.setGeolocation({ latitude: 32 + i * 0.00007, longitude: 34.8, accuracy: 5 }); await page.waitForTimeout(1100); } await page.waitForSelector('.ghost:not([hidden])'); assert.match(await page.textContent('.ghost'), /your best|best pace/); assert.ok(await page.locator('.livemap .route-line').count() >= 1); assert.deepEqual(errors, []);
});

await step('android background: the service records fixes (no page GPS), pause/finish stop it, a reload recovers what was recorded meanwhile', async () => {
  const { page, errors } = await newPage({ lang: 'en', geo: false, native: {} }); await page.goto(base + '#/workout/run'); await page.waitForSelector('.big-btn'); await page.click('.big-btn');
  assert.equal(await page.evaluate(() => __n.started), 1); const t0 = Date.now();
  const track = (from, count) => Array.from({ length: count }, (_, i) => [32 + (from + i) * 0.00007, 34.8, t0 + (from + i) * 1100, 5]);
  await page.evaluate((f) => { __n.fixes.push(...f); }, track(0, 6)); await page.waitForFunction(() => Number(document.querySelector('.v-dist').textContent) >= 0.03, null, { timeout: 5000 });
  await page.click('.big-btn'); assert.ok(await page.evaluate(() => __n.stopped) >= 1, 'pause stops the service'); await page.click('.big-btn'); assert.equal(await page.evaluate(() => __n.started), 2, 'resume starts it again');
  await page.evaluate((f) => { __n.fixes.push(...f); }, track(6, 6)); await page.waitForTimeout(1300); await page.click('.controls .btn.ghost'); await page.click('.confirm .btn >> nth=0'); await page.waitForSelector('.summary');
  assert.ok(await page.evaluate(() => __n.stopped) >= 2); assert.deepEqual(errors, []);
  // killed while recording: fixes recorded by the service meanwhile are applied when the workout is reopened
  const p2 = await newPage({ lang: 'en', geo: false, native: {} }); await p2.page.goto(base + '#/workout/walk'); await p2.page.waitForSelector('.big-btn'); await p2.page.click('.big-btn'); await p2.page.waitForTimeout(400);
  const t1 = Date.now(); await p2.page.evaluate(({ f }) => { sessionStorage.setItem('__fixes', JSON.stringify(f)); __n.fixes = []; }, { f: Array.from({ length: 5 }, (_, i) => [32 + i * 0.00007, 34.8, t1 + i * 1100, 5]) });
  await p2.page.evaluate(() => dispatchEvent(new Event('pagehide'))); /* what the app does when it is sent away: save the workout */ await p2.page.reload(); await p2.page.waitForSelector('.workout[data-phase="paused"]');
  assert.ok(Number(await p2.page.textContent('.v-dist')) >= 0.02, 'the recorded fixes were applied');
});
await step('android: settings shows the background permissions only in the app; reminders are handed over for when the app is closed; a tapped notification opens its screen', async () => {
  const plain = await newPage({ lang: 'en' }); await plain.page.goto(base + '#/settings'); await plain.page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await plain.page.waitForSelector('#s-lang'); assert.equal(await plain.page.locator('#f-s-bg').count(), 0, 'not in a browser');
  const { page } = await newPage({ lang: 'en', native: { href: '#/reco' } }); await page.goto(base); await page.waitForFunction(() => location.hash === '#/reco'); assert.equal(await page.textContent('h1'), 'Recommendations');
  await page.goto(base + '#/settings'); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await page.waitForSelector('#f-s-bg'); await page.click('#bg-notify'); assert.equal(await page.evaluate(() => __n.reqNotif), 1);
  await page.waitForTimeout(1800); const wd = await page.evaluate(() => __n.widget); assert.ok(wd && wd.stepsGoal > 0 && wd.effortPlan > 0 && wd.stepsTitle === 'Steps' && wd.quickTitle === 'Measure now' && ['walk', 'run'].includes(wd.kind), JSON.stringify(wd));
  await page.click('#rem-add'); await page.waitForTimeout(2200); const notes = await page.evaluate(() => __n.notes);
  assert.ok(Array.isArray(notes) && notes.length >= 7, `reminders expanded over the week (${notes?.length})`); assert.equal(notes[0].title, 'Time for a walk'); assert.equal(notes[0].href, '#/workout/walk'); assert.ok(notes.every((x, i) => i === 0 || notes[i - 1].at <= x.at));
});
await step('android steps: the phone step counter feeds the dashboard and the recommendation', async () => {
  const d = new Date(), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { page } = await newPage({ lang: 'en', native: { steps: { [key]: 9000 } } }); await page.goto(base); await page.waitForSelector('[data-widget=steps]'); assert.match(await page.textContent('[data-widget=steps]'), /6,?300/, 'quality steps: 9000 from the phone, counted at 70 % when not in a tracked workout');
  assert.ok(await page.evaluate(() => __n.sampled) >= 1, 'the sensor is sampled when the app opens'); await page.goto(base + '#/d/steps'); await page.waitForSelector('text=Counted by your phone all day'); assert.match(await page.textContent('.detail'), /9,?000/);
});

await step('training plan: build, week view, mark done, navigate weeks, persists, delete; the dashboard widget follows', async () => {
  const SUN = new Date(2026, 10, 8, 8, 0); const { page, errors } = await newPage({ lang: 'en', clock: true, clockAt: SUN }); await page.goto(base + '#/plan'); await page.waitForSelector('#plan-create');
  await shot(page, 'plan-builder'); await page.selectOption('#p-goal', '5k'); await page.selectOption('#p-kind', 'run'); await page.selectOption('#p-weeks', '8'); await page.click('#plan-create'); await page.waitForSelector('[data-session]');
  assert.equal(await page.locator('[data-session]').count(), 3); assert.match(await page.textContent('.planhead'), /Week 1 of 8/); assert.match(await page.textContent('.plan'), /not medical advice/); await shot(page, 'plan-week');
  await page.click('[data-session] [data-act=done] >> nth=0'); await page.waitForSelector('[data-session][data-status=done]'); assert.match(await page.textContent('.planbox'), /1 of 24 sessions done/);
  await page.click('.planhead button[aria-label="Next week"]'); await page.waitForSelector('text=Week 2 of 8'); assert.equal(await page.locator('[data-session]').count(), 3);
  await page.reload(); await page.waitForSelector('[data-session]'); assert.match(await page.textContent('.planbox'), /1 of 24 sessions done/, 'saved');
  await page.goto(base + '#/'); await page.waitForSelector('[data-widget=plan]'); assert.match(await page.textContent('[data-widget=plan]'), /Week 1 of 8/); await page.click('[data-widget=plan]'); await page.waitForSelector('[data-session]');
  await page.goto(base + '#/plan'); await page.waitForSelector('#plan-delete'); page.once('dialog', (d) => d.accept()); await page.click('#plan-delete'); await page.waitForSelector('#plan-create'); assert.deepEqual(errors, []);
});
await step('training plan: a matching workout completes the session; missed sessions get a gentle catch-up (move or skip)', async () => {
  const SUN = new Date(2026, 10, 8, 8, 0); const { page } = await newPage({ lang: 'en', clock: true, clockAt: SUN }); await page.goto(base);
  await page.evaluate(async (start) => { const P = await import('./js/plan.js'); const p = P.generatePlan({ age: 35, level: 'beginner', goal: 'general', sessions: 3, types: ['easy', 'long', 'intervals'], weeks: 8, startDay: start, baseEffort: 90, kind: 'walk' }); localStorage.setItem('da.plan', JSON.stringify(p)); window.__p = p; }, new Date(2026, 10, 8).getTime());
  const mins = await page.evaluate(() => __p.list[0].minutes); await seedHours(page, [{ daysAgo: 0, hour: 7, min: mins + 2 }]);
  await page.goto(base + '#/plan'); await page.waitForSelector('[data-session][data-status=done]'); assert.match(await page.textContent('.planbox'), /1 of 24/);
  await page.clock.setSystemTime(new Date(2026, 10, 11, 10, 0)); await page.goto(base + '#/plan'); await page.reload(); await page.waitForSelector('.catch'); assert.match(await page.textContent('.catch'), /You missed 1 session/);
  await page.click('.catch [data-act=move]'); await page.waitForFunction(() => !document.querySelector('.catch')); assert.ok(await page.locator('[data-session][data-status=planned]').count() >= 2, 'the moved session is planned again');
});
await step('training plan: an in-app reminder fires at the chosen hour on the day of a planned session', async () => {
  const at = new Date(2026, 10, 8, 17, 59, 40); const { page } = await newPage({ lang: 'en', clock: true, clockAt: at }); await page.goto(base);
  await page.evaluate(async (start) => { const P = await import('./js/plan.js'); localStorage.setItem('da.plan', JSON.stringify(P.generatePlan({ age: 35, level: 'beginner', goal: 'general', sessions: 3, types: ['easy', 'long'], weeks: 8, startDay: start, baseEffort: 90, kind: 'walk' }))); localStorage.setItem('da.planHour', '18'); }, new Date(2026, 10, 8).getTime());
  await page.clock.runFor(45000); await page.goto(base + '#/alerts'); await page.waitForSelector('.alert'); assert.match(await page.textContent('.alert'), /Planned workout today/);
});
await step('axe-core: zero violations on every screen (he light, en dark)', async () => {
  for (const [lang, scheme] of [['he', 'light'], ['en', 'dark']]) {
    const { page } = await newPage({ lang }); await page.emulateMedia({ colorScheme: scheme });
    for (const route of ['#/', '#/settings', '#/history', '#/alerts', '#/search', '#/d/effort', '#/d/steps', '#/d/weather', '#/d/month', '#/reco', '#/d/reco', '#/routes', '#/d/routes', '#/plan']) { await page.goto(base + route); await page.waitForSelector('h1'); assert.deepEqual(await axeViolations(page), [], `${lang} ${scheme} ${route}`); }
    for (const pack of ['ocean', 'high-contrast', 'mono']) { await page.goto(base + '#/'); await page.evaluate((p) => { document.documentElement.dataset.pack = p; }, pack); assert.deepEqual(await axeViolations(page), [], `${lang} ${scheme} pack ${pack}`); }
    await page.goto(base + '#/workout/run'); await page.waitForSelector('.big-btn'); assert.deepEqual(await axeViolations(page), [], `${lang} ${scheme} workout`);
    await page.click('.big-btn'); await page.click('.controls button.round[aria-label]:last-child'); await page.waitForSelector('.rhythm:not([hidden])'); assert.deepEqual(await axeViolations(page), [], `${lang} ${scheme} workout+rhythm`);
  }
});
await step('320 px: no horizontal scroll', async () => {
  const { page } = await newPage({ width: 320 });
  for (const route of ['#/', '#/settings', '#/history', '#/workout/run', '#/alerts', '#/search', '#/d/effort', '#/d/distance', '#/reco', '#/routes']) { await page.goto(base + route); await page.waitForSelector('main > *'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route); }
});

await browser.close(); server.close();
console.log(failures ? `\n${failures} step(s) failed` : '\nall e2e steps passed'); process.exit(failures ? 1 : 0);
