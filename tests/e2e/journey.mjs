// A guided tour of the app in real Chromium: walks the main user journeys, saves a screenshot at every step, and audits each screen with simple usability
// heuristics (touch targets, overflow, tiny text, broken pictures, one h1, number of choices) plus axe. Usage: node tests/e2e/journey.mjs <out-dir>
// It prints a table of findings; contact sheets (several screens side by side) are written next to the screenshots for a visual review.
import { chromium } from 'playwright';
import axe from 'axe-core';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { serve } from '../../scripts/serve.mjs';

const out = process.argv[2] || '/tmp/journey'; mkdirSync(out, { recursive: true });
const server = await serve('web', 0), base = `http://localhost:${server.address().port}/`, browser = await chromium.launch();
const findings = [], shotsList = []; let n = 0;

async function ctxPage({ lang = 'he', width = 390, height = 800, scheme = 'light', geo = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'en-US', colorScheme: scheme, serviceWorkers: 'block', ...(geo ? { permissions: ['geolocation'], geolocation: { latitude: 32, longitude: 34.8, accuracy: 5 } } : {}) });
  await ctx.addInitScript((l) => { try { localStorage.setItem('da.lang', l); } catch { /* blocked */ } }, lang);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors };
}

/** Usability heuristics for what is on screen right now. */
async function audit(page, name) {
  const r = await page.evaluate(() => {
    const vis = (e) => { const b = e.getBoundingClientRect(), s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && b.bottom > 0 && b.top < innerHeight * 3; };
    const small = [], tiny = [], broken = []; const inter = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary, [role=button]')].filter(vis);
    for (const e of inter) { const b = e.getBoundingClientRect(); if (Math.min(b.width, b.height) < 40 && !e.closest('p, label.check, .sr-only') && !(e.tagName === 'INPUT' && e.type === 'checkbox')) small.push(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : e.className ? `.${String(e.className).split(' ')[0]}` : ''} ${Math.round(b.width)}x${Math.round(b.height)}`); }
    for (const e of document.querySelectorAll('body *')) { if (!vis(e)) continue; const cs = getComputedStyle(e); if (parseFloat(cs.fontSize) < 11 && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1) && !e.closest('svg')) tiny.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${cs.fontSize}`); }
    for (const i of document.images) if (i.complete && i.naturalWidth === 0 && i.getAttribute('src')) broken.push(i.getAttribute('src'));
    const above = inter.filter((e) => e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0).length;
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelectorAll('h1').length, small: small.slice(0, 6), tiny: [...new Set(tiny)].slice(0, 4), broken, choices: above, height: document.documentElement.scrollHeight };
  });
  await page.evaluate(axe.source); const ax = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => `${v.id}(${v.nodes.length})`));
  const issues = []; if (r.overflow) issues.push('horizontal overflow'); if (r.h1 !== 1) issues.push(`h1 count ${r.h1}`); if (r.small.length) issues.push(`small targets: ${r.small.join(', ')}`); if (r.tiny.length) issues.push(`tiny text: ${r.tiny.join(', ')}`);
  if (r.broken.length) issues.push(`broken pictures: ${r.broken.join(', ')}`); if (ax.length) issues.push(`axe: ${ax.join(', ')}`); if (r.choices > 12) issues.push(`${r.choices} choices above the fold`);
  findings.push({ name, choices: r.choices, issues });
}
async function shot(page, flow, label, { full = false, noaudit = false } = {}) {
  n++; const file = `${flow}-${String(n).padStart(2, '0')}-${label}.png`; await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${file}`, fullPage: full }); shotsList.push({ flow, file, label }); if (!noaudit) await audit(page, `${flow}/${label}`);
}
const move = async (ctx, page, steps, dLat = 0.00007) => { for (let i = 1; i <= steps; i++) { await ctx.setGeolocation({ latitude: 32 + i * dLat, longitude: 34.8, accuracy: 5 }); await page.waitForTimeout(1100); } };

const PATHS = { L: [[0, 0], [600, 0], [600, 600]], other: [[0, 400], [600, 400], [600, 1000]] };
async function seed(page, rows) {
  await page.evaluate(async ({ list, paths }) => {
    const S = await import('./js/store.js'), M = 1 / 111195, C = Math.cos(32 * Math.PI / 180);
    for (const r of list) {
      const mps = 1000 / r.pace, corners = paths[r.path || 'L'], pts = []; let t = 0; const d0 = new Date(Date.now()); d0.setDate(d0.getDate() - r.daysAgo); d0.setHours(r.hour, 5, 0, 0); const start = d0.getTime();
      for (let i = 1; i < corners.length; i++) { const [ax, ay] = corners[i - 1], [bx, by] = corners[i], k0 = i === 1 ? 0 : 1, n = Math.ceil(Math.hypot(bx - ax, by - ay) / mps); for (let k = k0; k <= n; k++) { const f = k / n; pts.push([32 + (ay + (by - ay) * f) * M, 34.8 + (ax + (bx - ax) * f) * M / C, start + t * 1000]); t += k === n && i < corners.length - 1 ? 0 : 1; } }
      const len = 1200; await S.saveWorkout({ kind: r.kind || 'run', startedAt: start, endedAt: start + t * 1000, pausedMs: 0, pausedAt: 0, distanceM: len, movingMs: t * 1000, splits: [{ km: 1, atMs: Math.round(1000 / mps * 1000) }], points: pts });
      if (r.weather) await S.updateWorkout(start, { weather: r.weather });
    }
  }, { list: rows, paths: PATHS });
}
const HIST = [{ daysAgo: 30, hour: 7, pace: 380 }, { daysAgo: 26, hour: 18, pace: 370, kind: 'walk' }, { daysAgo: 23, hour: 7, pace: 365 }, { daysAgo: 19, hour: 7, pace: 350, weather: { tempC: 12, cond: 'clear' } }, { daysAgo: 16, hour: 18, pace: 360, kind: 'walk' }, { daysAgo: 12, hour: 7, pace: 345 }, { daysAgo: 9, hour: 7, pace: 340, path: 'other', weather: { tempC: 27, cond: 'clear' } }, { daysAgo: 6, hour: 18, pace: 335, kind: 'walk' }, { daysAgo: 4, hour: 7, pace: 330, weather: { tempC: 18, cond: 'rain' } }, { daysAgo: 2, hour: 7, pace: 322 }, { daysAgo: 1, hour: 18, pace: 355, kind: 'walk' }, { daysAgo: 0, hour: 6, pace: 318 }];

// ---------- A: first run (Hebrew, a brand-new person) ----------
{ const { ctx, page, errors } = await ctxPage({ lang: 'he' });
  await page.goto(base); await page.waitForSelector('#welcome'); await shot(page, 'A', 'he-first-launch');
  await page.fill('#welcome-age', '41'); await page.click('#welcome-ok'); await page.waitForSelector('#welcome', { state: 'detached' }); await shot(page, 'A', 'he-home-after-welcome');
  await page.click('a.start-card.walk, .start-card >> nth=0'); await page.waitForSelector('.gps-card'); await shot(page, 'A', 'he-workout-ready');
  await page.click('.big-btn'); await page.waitForSelector('.workout[data-phase="running"]'); await move(ctx, page, 4); await shot(page, 'A', 'he-workout-running');
  await page.click('.big-btn'); await page.waitForSelector('.workout[data-phase="paused"]'); await shot(page, 'A', 'he-workout-paused');
  await page.click('.controls .btn.ghost'); await page.waitForSelector('.confirm'); await shot(page, 'A', 'he-finish-question');
  await page.click('.confirm .btn.danger'); await page.waitForSelector('.start-card'); await shot(page, 'A', 'he-after-discard');
  await page.goto(base + '#/settings'); await page.waitForSelector('details.sec'); await shot(page, 'A', 'he-settings-collapsed');
  if (errors.length) findings.push({ name: 'A/console', issues: errors.slice(0, 3) }); await ctx.close(); }

// ---------- B: an established person (English) ----------
{ const { ctx, page, errors } = await ctxPage({ lang: 'en' });
  await page.goto(base); await page.waitForSelector('.start-card'); await seed(page, HIST); await page.evaluate(() => localStorage.setItem('da.welcomed', '1'));
  await page.goto(base); await page.waitForSelector('.daycard'); await shot(page, 'B', 'home-top'); await page.evaluate(() => scrollTo(0, 700)); await shot(page, 'B', 'home-widgets');
  await page.goto(base + '#/d/effort'); await page.waitForSelector('.drill'); await shot(page, 'B', 'drill-effort');
  await page.goto(base + '#/d/challenge'); await page.waitForSelector('.drill'); await shot(page, 'B', 'drill-challenge');
  await page.goto(base + '#/history'); await page.waitForSelector('.item'); await shot(page, 'B', 'history'); await page.click('.chip[data-sort=rec]'); await shot(page, 'B', 'history-records');
  await page.click('.chip[data-sort=rec]'); await page.click('.item >> nth=0'); await page.waitForSelector('#share-workout'); await shot(page, 'B', 'workout-detail'); await shot(page, 'B', 'workout-detail-full', { full: true, noaudit: true });
  await page.goto(base + '#/routes'); await page.waitForSelector('.routesbox, .list, .empty'); await shot(page, 'B', 'routes');
  await page.goto(base + '#/plan'); await page.waitForSelector('#plan-create'); await shot(page, 'B', 'plan-builder'); await page.click('#plan-create'); await page.waitForSelector('.planbox [data-session]'); await shot(page, 'B', 'plan-week');
  await page.goto(base + '#/reco'); await page.waitForSelector('h1'); await shot(page, 'B', 'recommendations');
  await page.goto(base + '#/alerts'); await page.waitForSelector('h1'); await shot(page, 'B', 'alerts');
  await page.goto(base + '#/search'); await page.waitForSelector('input[type=search]'); await page.fill('input[type=search]', 'run'); await page.waitForTimeout(400); await shot(page, 'B', 'search-run');
  await page.goto(base + '#/settings'); await page.evaluate(() => document.querySelectorAll('details.sec').forEach((d) => { d.open = true; })); await shot(page, 'B', 'settings-all-open', { full: true });
  await page.goto(base + '#/'); await page.waitForSelector('.start-card'); await page.click('.start-card >> nth=1'); await page.waitForSelector('.gps-card'); await shot(page, 'B', 'run-ready');
  await page.click('.big-btn'); await page.waitForSelector('.workout[data-phase="running"]'); await move(ctx, page, 5); await shot(page, 'B', 'run-running'); await page.click('#wk-sun'); await shot(page, 'B', 'run-sunlight'); await page.click('#wk-sun');
  await page.click('#wk-metro'); await page.waitForTimeout(500); await shot(page, 'B', 'run-metronome-on');
  if (errors.length) findings.push({ name: 'B/console', issues: errors.slice(0, 3) }); await ctx.close(); }

// ---------- C: a record and the celebration ----------
{ const { ctx, page, errors } = await ctxPage({ lang: 'en' });
  await page.goto(base); await page.waitForSelector('.start-card'); await page.evaluate(() => localStorage.setItem('da.welcomed', '1'));
  await page.evaluate(async () => { const { celebrationCard } = await import('./js/ui/podium.js'); document.getElementById('app').replaceChildren(Object.assign(document.createElement('h1'), { textContent: 'Summary' }), celebrationCard([{ id: 'distance', value: 12340, prev: 10000 }, { id: 'pace', value: 300, prev: 320 }], { startedAt: Date.now(), kind: 'run' })); });
  await shot(page, 'C', 'record-ask'); await page.click('#rec-nophoto'); await page.waitForTimeout(3500); await shot(page, 'C', 'record-podium'); if (errors.length) findings.push({ name: 'C/console', issues: errors.slice(0, 3) }); await ctx.close(); }

// ---------- D: variants (dark, Hebrew, 320 px, wide) ----------
for (const [tag, o] of [['dark-en', { lang: 'en', scheme: 'dark' }], ['he-320', { lang: 'he', width: 320 }], ['wide-en', { lang: 'en', width: 1100, height: 800 }]]) {
  const { ctx, page, errors } = await ctxPage(o); await page.goto(base); await page.waitForSelector('.start-card'); await seed(page, HIST); await page.evaluate(() => localStorage.setItem('da.welcomed', '1'));
  await page.goto(base); await page.waitForSelector('.daycard'); await shot(page, 'D', `${tag}-home`);
  await page.goto(base + '#/workout/walk'); await page.waitForSelector('.gps-card'); await page.click('.big-btn'); await page.waitForSelector('.workout[data-phase="running"]'); await move(ctx, page, 3); await shot(page, 'D', `${tag}-workout`);
  await page.goto(base + '#/history'); await page.waitForSelector('.item'); await shot(page, 'D', `${tag}-history`);
  if (errors.length) findings.push({ name: `D/${tag}/console`, issues: errors.slice(0, 3) }); await ctx.close(); }

// ---------- report + contact sheets ----------
writeFileSync(`${out}/findings.json`, JSON.stringify(findings, null, 1));
let bad = 0; for (const f of findings) { if (f.issues.length) { bad++; console.log(`✗ ${f.name}${f.choices != null ? ` [${f.choices} choices]` : ''}: ${f.issues.join(' | ')}`); } }
console.log(`${findings.length} screens audited, ${bad} with findings`);
const files = shotsList.filter((s) => !/full/.test(s.label)); const sheet = await (await browser.newContext({ viewport: { width: 1700, height: 900 } })).newPage();
for (let i = 0, k = 1; i < files.length; i += 4, k++) {
  const group = files.slice(i, i + 4); const html = `<body style="margin:0;background:#888;display:flex;gap:10px;padding:10px;align-items:flex-start">${group.map((g) => `<figure style="margin:0;font:600 14px sans-serif;color:#fff"><img src="file://${out}/${g.file}" style="height:820px;display:block"><figcaption>${g.file.replace('.png', '')}</figcaption></figure>`).join('')}</body>`;
  await sheet.setContent(html); await sheet.waitForTimeout(300); await sheet.screenshot({ path: `${out}/sheet-${String(k).padStart(2, '0')}.png`, fullPage: true });
}
await browser.close(); server.close();
