// Renders the puppet engine with the placeholder atlas at eight phases of the walk and the run, to check the rig by eye. Usage: node tests/puppet/demo.mjs [out.png]
import { chromium } from 'playwright';
import { serve } from '../../scripts/serve.mjs';
import { PART_SHAPES, PLACEHOLDER } from './placeholder.mjs';
const out = process.argv[2] || '/tmp/puppet-demo.png';
const server = await serve('web', 0), base = `http://localhost:${server.address().port}/`, browser = await chromium.launch(), page = await (await browser.newContext({ viewport: { width: 1700, height: 760 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + 'index.html');
const png = await page.evaluate(async (shapes) => { // build the atlas on a canvas: one cell per part, filled with its shape
  const names = Object.keys(shapes), cell = 200, cv = document.createElement('canvas'); cv.width = cell * 4; cv.height = cell * Math.ceil(names.length / 4); const g = cv.getContext('2d'), rects = {};
  names.forEach((n, i) => { const [w, hh, px, py, col] = shapes[n], x = (i % 4) * cell, y = Math.floor(i / 4) * cell; g.fillStyle = col; g.strokeStyle = '#123'; g.lineWidth = 3; g.beginPath(); g.roundRect(x + 4, y + 4, w - 8, hh - 8, Math.min(w, hh) / 2.2); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + px, y + py, 4, 0, 7); g.fill(); rects[n] = [x, y, w, hh]; });
  return { url: cv.toDataURL('image/png'), rects };
}, PART_SHAPES);
const data = PLACEHOLDER(png.url); for (const [n, p] of Object.entries(data.parts)) { const s = PART_SHAPES[n]; p.rect = png.rects[n]; p.pivot = [s[2], s[3]]; }
await page.evaluate(async ({ data, base }) => {
  const { createPuppet } = await import(`${base}js/ui/puppet.js`); const { CYCLE } = await import(`${base}js/puppetRig.js`);
  document.body.replaceChildren(); document.body.style.cssText = 'margin:0;background:#F5F8FA;display:grid;gap:8px;padding:8px';
  for (const kind of ['walk', 'run']) { const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:4px;background:#fff'; document.body.append(row);
    for (let i = 0; i < 8; i++) { const p = createPuppet(data, kind, 200, { animate: true }); row.append(p); p.dataset.phase = String(i / 8); p.dataset.ms = String(CYCLE[kind].ms); } }
}, { data, base });
await page.waitForTimeout(300);
await page.evaluate(() => { for (const p of document.querySelectorAll('.puppet')) for (const j of p.querySelectorAll('.pp-joint')) for (const a of j.getAnimations()) { a.pause(); a.currentTime = Number(p.dataset.phase) * Number(p.dataset.ms); } });
await page.waitForTimeout(100); await page.screenshot({ path: out });
console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no errors', '->', out); await browser.close(); server.close();
