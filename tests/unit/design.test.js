import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ICONS } from '../../web/js/iconData.js';

const tokens = JSON.parse(readFileSync('design/momentum/tokens.json', 'utf8'));
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
test('icon data only uses safe drawing elements', () => {
  for (const [name, kids] of Object.entries(ICONS)) { assert.ok(kids.length, name); for (const [tag, attrs] of kids) { assert.match(tag, /^(circle|path|rect|line|polyline|polygon|ellipse)$/); for (const k of Object.keys(attrs)) assert.ok(!/^on|href|style/i.test(k), `${name}.${k}`); } }
});
