// Checks a character SVG against the app's "rig" contract (see docs/DESIGNER_BRIEF.md). Usage: node scripts/check-trail-svg.mjs <file.svg>...
// Exit code 1 when any file breaks the contract. The rule set is the same one scripts/build-design.mjs enforces when the pose is built into the app.
import { readFileSync } from 'node:fs';
export const OK_TAGS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
export const OK_ATTRS = new Set(['xmlns', 'viewBox', 'width', 'height', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform', 'opacity', 'fill-rule', 'clip-rule', 'fill-opacity', 'stroke-opacity', 'class', 'data-pose', 'data-theme']);
export const REQUIRED = ['m-head', 'm-torso', 'm-arm-a', 'm-arm-b', 'm-leg-a', 'm-leg-b', 'm-ribbon', 'm-shadow'];
export const OPTIONAL = ['m-streaks', 'm-sweat', 'm-prop', 'm-extra', 'm-shin-a', 'm-shin-b', 'm-foot-a', 'm-foot-b', 'm-eyes', 'm-smile', 'm-character'];
const COLOR = /^(none|#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$/;

/** Returns a list of problems (empty = fine). */
export function checkTrailSvg(src, { name = 'svg' } = {}) {
  const bad = [], classes = new Set();
  if (Buffer.byteLength(src) > 20000) bad.push(`${name}: bigger than 20 KB (${Buffer.byteLength(src)} bytes)`);
  if (!/^\s*<svg\b[^>]*\bviewBox="0 0 200 200"/.test(src)) bad.push(`${name}: the root must be <svg ... viewBox="0 0 200 200">`);
  if (/<(style|defs|linearGradient|radialGradient|clipPath|mask|filter|use|image|text|script|foreignObject|animate\w*)\b/i.test(src)) bad.push(`${name}: forbidden element (style, defs, gradient, clipPath, mask, filter, use, image, text, script, animate)`);
  for (const m of src.matchAll(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g)) {
    const [, tag, rest] = m; if (m[0].startsWith('</')) continue;
    if (!OK_TAGS.has(tag)) bad.push(`${name}: element <${tag}> is not allowed`);
    for (const a of rest.matchAll(/([\w:-]+)="([^"]*)"/g)) {
      const [, k, v] = a;
      if (!OK_ATTRS.has(k)) bad.push(`${name}: attribute ${k}="${v.slice(0, 30)}" is not allowed (no style, id, filter, clip-path, mask, url())`);
      if (k === 'fill' || k === 'stroke') { if (!COLOR.test(v)) bad.push(`${name}: ${k}="${v}" must be a hex colour or none`); }
      if (k === 'class') for (const c of v.split(/\s+/)) { classes.add(c); if (!/^(m-[a-z-]+|trail-companion)$/.test(c)) bad.push(`${name}: class "${c}" is not one of the part names`); }
      if (k !== 'xmlns' && /url\(|javascript:|https?:/i.test(v)) bad.push(`${name}: ${k} must not contain url() or links`);
    }
  }
  for (const c of REQUIRED) if (!classes.has(c)) bad.push(`${name}: missing the group class="${c}"`);
  return [...new Set(bad)];
}
if (process.argv[1]?.endsWith('check-trail-svg.mjs')) {
  const files = process.argv.slice(2); if (!files.length) { console.log('usage: node scripts/check-trail-svg.mjs <file.svg>...'); process.exit(2); }
  let n = 0; for (const f of files) { const p = checkTrailSvg(readFileSync(f, 'utf8'), { name: f }); if (p.length) { n++; console.log(`✗ ${f}\n   ${p.join('\n   ')}`); } else console.log(`✓ ${f}`); }
  process.exit(n ? 1 : 0);
}
