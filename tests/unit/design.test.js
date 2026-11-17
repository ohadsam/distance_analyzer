import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ICONS } from '../../web/js/iconData.js';

const tokens = JSON.parse(readFileSync('design/stepup/tokens.json', 'utf8'));
const lum = (h) => { const a = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return [0.2126, 0.7152, 0.0722].reduce((s, w, i) => s + w * (a[i] <= 0.04045 ? a[i] / 12.92 : ((a[i] + 0.055) / 1.055) ** 2.4), 0); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => p - q); return (y + 0.05) / (x + 0.05); };

test('every pack, light and dark, meets WCAG contrast for text and boundaries', () => {
  for (const [name, modes] of Object.entries(tokens)) for (const [mode, t] of Object.entries(modes)) {
    for (const [fg, bg, min] of [['text', 'background', 4.5], ['text', 'surface', 4.5], ['muted', 'surface', 4.5], ['primary', 'surface', 4.5], ['onPrimary', 'primary', 4.5], ['outline', 'surface', 3], ['focus', 'background', 3], ['success', 'surface', 4.5], ['warning', 'surface', 4.5], ['danger', 'surface', 4.5], ['walk', 'surface', 4.5], ['run', 'surface', 4.5]])
      assert.ok(ratio(t[fg], t[bg]) >= min, `${name} ${mode} ${fg}/${bg} = ${ratio(t[fg], t[bg]).toFixed(2)}`);
  }
});
test('generated design files are up to date (run: npm run design)', () => {
  const before = [readFileSync('web/css/packs.css', 'utf8'), readFileSync('web/js/iconData.js', 'utf8')];
  execFileSync(process.execPath, ['scripts/build-design.mjs'], { stdio: 'pipe' });
  assert.deepEqual([readFileSync('web/css/packs.css', 'utf8'), readFileSync('web/js/iconData.js', 'utf8')], before);
});
test('icon data only uses safe drawing elements and attributes (nested)', () => {
  const OK = /^(g|circle|path|rect|line|polyline|polygon|ellipse)$/, BAD_ATTR = /^on|href|style|^id$/i; // class is allowed, but only the m-<part> hooks the motion CSS knows
  const walk = (name, nodes) => { for (const [tag, attrs, kids] of nodes) { assert.match(tag, OK, name); for (const [k, v] of Object.entries(attrs)) { assert.ok(!BAD_ATTR.test(k), `${name}.${k}`); if (k === 'class') assert.match(String(v), /^m-[a-z-]+$|^z[1-5]$/, `${name}.class`); assert.match(String(v), /^[\w\s.,#()%-]*$/, `${name}.${k}`); } walk(name, kids); } };
  for (const [name, nodes] of Object.entries(ICONS)) { assert.ok(nodes.length, name); walk(name, nodes); }
});
test('every icon the code asks for exists', () => {
  for (const n of ['home-active', 'route-active', 'calendar-active', 'star-active', 'gauge-speed', 'gauge-pace', 'stopwatch', 'calories', 'cadence', 'lastkm', 'avgpace', 'speed', 'exportfile', 'sharepic']) assert.ok(ICONS[n], n);
});

import { CHARACTER } from '../../web/js/characterData.js';
import { existsSync, statSync } from 'node:fs';
test('the character sprites exist, are small, and the poses the app uses are all there', () => {
  for (const [k, c] of Object.entries(CHARACTER.cycles)) { assert.equal(c.frames, 8, k); assert.ok(c.ms >= 500 && c.ms <= 1500, k); assert.ok(existsSync(`web/${c.file}`), c.file); assert.ok(statSync(`web/${c.file}`).size < 150000, `${c.file} stays under 150 KB`); }
  for (const n of ['idle', 'jump', 'cheer', 'wave', 'rest', 'stretch', 'medal', 'trophy', 'podium', 'point', 'think']) { assert.ok(CHARACTER.poses[n], n); assert.ok(existsSync(`web/${CHARACTER.poses[n].file}`), n); }
  let total = 0; for (const p of [...Object.values(CHARACTER.cycles), ...Object.values(CHARACTER.poses)]) total += statSync(`web/${p.file}`).size; assert.ok(total < 700000, `all character art together stays under 700 KB (${total})`);
});
