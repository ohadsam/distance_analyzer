// The StepUp brand drawn inline (so it takes the colours of the active pack): symbol and wordmark from design/stepup (generated brandData.js).
// The symbol and the Latin wordmark are never mirrored, also in RTL; only their position in a row follows the text direction.
import { MARK, WORD, WORD_SHIFT, WORD_VIEW, WORD_STROKE } from './brandData.js';
const NS = 'http://www.w3.org/2000/svg';

function svg(view, attrs, kids) {
  const el = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: view, 'aria-hidden': 'true', focusable: 'false', ...attrs })) el.setAttribute(k, v);
  for (const [tag, a, wrap] of kids) { const c = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) c.setAttribute(k, v); (wrap || el).append(c); }
  return el;
}
export function brandMark(size = 28) {
  const el = svg('0 0 64 64', { width: size, height: size, class: 'brand-mark', fill: 'none', stroke: 'currentColor', 'stroke-width': 5.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, []);
  for (const [tag, a] of MARK) { const c = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) c.setAttribute(k, v); if (tag === 'circle') { c.setAttribute('fill', 'currentColor'); c.setAttribute('stroke', 'none'); } el.append(c); }
  return el;
}
export function brandWordmark(height = 22) {
  const [, , w, h] = WORD_VIEW.split(' ').map(Number);
  const el = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: WORD_VIEW, height, width: Math.round((height * w) / h), class: 'brand-word', 'aria-hidden': 'true', focusable: 'false' })) el.setAttribute(k, v);
  const g = document.createElementNS(NS, 'g'); g.setAttribute('transform', `translate(${WORD_SHIFT})`);
  for (const k of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) g.setAttribute(k, { fill: 'none', stroke: 'currentColor', 'stroke-width': WORD_STROKE, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }[k]);
  for (const [tag, a] of WORD) { const c = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) c.setAttribute(k, v); g.append(c); }
  el.append(g); return el;
}
