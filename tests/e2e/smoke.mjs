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
async function newPage({ lang = 'he', width = 390, geo = true, clock = false, signalGapMs = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'en-US', serviceWorkers: 'block', ...(geo ? { permissions: ['geolocation'], geolocation: { latitude: 32, longitude: 34.8, accuracy: 5 } } : {}) });
  if (lang !== 'he') await ctx.addInitScript((l) => { try { localStorage.setItem('da.lang', l); } catch { /* blocked */ } }, lang);
  const page = await ctx.newPage(); const errors = [];
  if (clock) await page.clock.install();
  if (signalGapMs) await page.addInitScript(fakeFootsteps, signalGapMs); // after the fake clock, so its timer is fake too
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { page, errors, ctx };
}
// Injected into the page: dispatches motion events that look like a runner with one foot strike every `gap` ms.
function fakeFootsteps(gap) {
  setInterval(() => { const d = performance.now() % gap, v = d < 160 ? 6 * Math.sin((Math.PI * d) / 160) : 0; const e = new Event('devicemotion'); e.accelerationIncludingGravity = { x: 0, y: 9.8 + v, z: 0 }; dispatchEvent(e); /* desktop Chromium has no DeviceMotionEvent */ }, 20);
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
async function axeViolations(page) {
  await page.evaluate(axe.source); // evaluate (not addScriptTag): the page CSP forbids inline scripts
  return page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
}

await step('boots in Hebrew/RTL by default with no console errors', async () => {
  const { page, errors } = await newPage(); await page.goto(base); await page.waitForSelector('h1');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl'); assert.equal(await page.getAttribute('html', 'lang'), 'he'); assert.deepEqual(errors, []); await shot(page, 'home-he');
});
await step('English is LTR; settings switches language without a reload', async () => {
  const { page, errors } = await newPage({ lang: 'en' }); await page.goto(base + '#/settings'); await page.waitForSelector('h1');
  assert.equal(await page.getAttribute('html', 'dir'), 'ltr'); assert.equal(await page.textContent('h1'), 'Settings');
  await page.selectOption('select >> nth=0', 'he'); await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  assert.equal(await page.textContent('h1'), 'הגדרות'); assert.deepEqual(errors, []);
});

await step('home offers walk and run; history is empty at first', async () => {
  const { page, errors } = await newPage({ lang: 'en' }); await page.goto(base); await page.waitForSelector('.start-card');
  assert.equal(await page.locator('.start-card').count(), 2); await page.waitForSelector('text=No workouts yet'); assert.deepEqual(errors, []); await shot(page, 'home-en');
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
  await page.click('.summary a.btn'); await page.waitForSelector('.item'); assert.equal(await page.locator('.item').count(), 1); assert.deepEqual(errors, []);
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
  await page.click('.controls .btn.ghost'); await page.click('.confirm .btn >> nth=0'); await page.waitForSelector('.start-card'); assert.equal(await page.locator('.item').count(), 0);
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
  const { page } = await newPage({ lang: 'en' }); await page.goto(base + '#/settings'); await page.waitForSelector('#s-pack');
  await page.selectOption('#s-pack', 'ocean'); assert.equal(await page.getAttribute('html', 'data-pack'), 'ocean');
  await page.selectOption('#s-breath', '2:2'); await page.reload(); await page.waitForSelector('#s-breath'); assert.equal(await page.inputValue('#s-breath'), '2:2'); assert.equal(await page.getAttribute('html', 'data-pack'), 'ocean');
});
await step('axe-core: zero violations on every screen (he light, en dark)', async () => {
  for (const [lang, scheme] of [['he', 'light'], ['en', 'dark']]) {
    const { page } = await newPage({ lang }); await page.emulateMedia({ colorScheme: scheme });
    for (const route of ['#/', '#/settings', '#/history']) { await page.goto(base + route); await page.waitForSelector('h1'); assert.deepEqual(await axeViolations(page), [], `${lang} ${scheme} ${route}`); }
    for (const pack of ['ocean', 'high-contrast', 'mono']) { await page.goto(base + '#/'); await page.evaluate((p) => { document.documentElement.dataset.pack = p; }, pack); assert.deepEqual(await axeViolations(page), [], `${lang} ${scheme} pack ${pack}`); }
    await page.goto(base + '#/workout/run'); await page.waitForSelector('.big-btn'); assert.deepEqual(await axeViolations(page), [], `${lang} ${scheme} workout`);
    await page.click('.big-btn'); await page.click('.controls button.round[aria-label]:last-child'); await page.waitForSelector('.rhythm:not([hidden])'); assert.deepEqual(await axeViolations(page), [], `${lang} ${scheme} workout+rhythm`);
  }
});
await step('320 px: no horizontal scroll', async () => {
  const { page } = await newPage({ width: 320 });
  for (const route of ['#/', '#/settings', '#/history', '#/workout/run']) { await page.goto(base + route); await page.waitForSelector('main > *'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route); }
});

await browser.close(); server.close();
console.log(failures ? `\n${failures} step(s) failed` : '\nall e2e steps passed'); process.exit(failures ? 1 : 0);
