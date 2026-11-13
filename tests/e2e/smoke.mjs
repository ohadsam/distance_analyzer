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
async function newPage({ lang = 'he', width = 390 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'en-US', serviceWorkers: 'block' });
  if (lang !== 'he') await ctx.addInitScript((l) => { try { localStorage.setItem('da.lang', l); } catch { /* blocked */ } }, lang);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { page, errors };
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
await step('axe-core: zero violations on every screen (he light, en dark)', async () => {
  for (const [lang, scheme] of [['he', 'light'], ['en', 'dark']]) {
    const { page } = await newPage({ lang }); await page.emulateMedia({ colorScheme: scheme });
    for (const route of ['#/', '#/settings']) { await page.goto(base + route); await page.waitForSelector('h1'); assert.deepEqual(await axeViolations(page), [], `${lang} ${scheme} ${route}`); }
  }
});
await step('320 px: no horizontal scroll', async () => {
  const { page } = await newPage({ width: 320 });
  for (const route of ['#/', '#/settings']) { await page.goto(base + route); await page.waitForSelector('h1'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route); }
});

await browser.close(); server.close();
console.log(failures ? `\n${failures} step(s) failed` : '\nall e2e steps passed'); process.exit(failures ? 1 : 0);
