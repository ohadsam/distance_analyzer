import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checkTrailSvg } from '../../scripts/check-trail-svg.mjs';

test('every Trail pose built into the app passes the designer contract', () => {
  const files = readdirSync('design/stepup/round9').filter((f) => /^trail-.*-(light|dark)\.svg$/.test(f)); assert.ok(files.length >= 20);
  for (const f of files) assert.deepEqual(checkTrailSvg(readFileSync(`design/stepup/round9/${f}`, 'utf8'), { name: f }), [], f);
});
test('the checker rejects what the app cannot draw', () => {
  const ok = readFileSync('design/stepup/round9/trail-walk-light.svg', 'utf8');
  const has = (src, re) => checkTrailSvg(src).some((p) => re.test(p));
  assert.ok(has(ok.replace('<g class="m-head"', '<g style="opacity:.5" class="m-head"'), /style/));
  assert.ok(has(ok.replace('</svg>', '<defs><linearGradient id="a"/></defs></svg>'), /forbidden element/));
  assert.ok(has(ok.replace('viewBox="0 0 200 200"', 'viewBox="0 0 100 100"'), /viewBox/));
  assert.ok(has(ok.replace('class="m-leg-a"', 'class="leg"'), /not one of the part names|missing the group class="m-leg-a"/));
  assert.ok(has(ok.replace(/fill="#[0-9A-Fa-f]{6}"/, 'fill="url(#g)"'), /hex colour|url\(\)/));
  assert.ok(has('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g class="m-head"/></svg>', /missing the group/));
});
