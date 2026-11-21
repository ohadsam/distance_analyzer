// Direction arrows and the written turn-by-turn list of a route (from its own geometry, see nav.js). Used by the route planner, the route screen and the workout's navigation banner.
import { h } from '../util.js';
import { t } from '../i18n.js';
import { turnsOf, stepsOf, lengthOf, roundDist } from '../nav.js';

const NS = 'http://www.w3.org/2000/svg';
const ARROW = { straight: 'M12 20V5M6 11l6-6 6 6', right: 'M7 21V11a4 4 0 0 1 4-4h9M16 3l4 4-4 4', left: 'M17 21V11a4 4 0 0 0-4-4H4M8 3L4 7l4 4', 'slight-right': 'M7 20L17 6M10 6h7v7', 'slight-left': 'M17 20L7 6M14 6H7v7',
  'sharp-right': 'M5 8h9a4 4 0 0 1 4 4v8M14 16l4 4 4-4', 'sharp-left': 'M19 8h-9a-4 4 0 0 0-4 4v8M10 16l-4 4-4-4', uturn: 'M7 20V9a4 4 0 0 1 8 0v8M11 13l4 4 4-4', arrive: 'M6 21V4M6 5h11l-3 4 3 4H6' };
/** A direction arrow (real-world left / right: it never mirrors in RTL). dir: straight | left | right | slight-left | slight-right | sharp-left | sharp-right | uturn | arrive. */
export function turnIcon(dir, size = 28) {
  const svg = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, class: 'turnicon', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, String(v));
  for (const [k, v] of Object.entries({ d: ARROW[dir] || ARROW.straight, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) p.setAttribute(k, String(v));
  svg.append(p); return svg;
}
/** "350 m" / "1.2 km" in the active language. */
export function distText(m) { const d = roundDist(m); return d.unit === 'm' ? t('navM', { n: d.value }) : t('navKm', { n: d.value }); }
export const turnText = (dir) => t(`navDir_${dir}`);

/** A <details> with the written steps of `path`, or null for a route too short to need one. `open` shows it expanded. */
export function directionsBox(path, { turns = null, open = false } = {}) {
  if (!Array.isArray(path) || path.length < 2) return null;
  const total = lengthOf(path), steps = stepsOf(turns || turnsOf(path), total), n = steps.length - 2;
  return h('details', { class: 'dirs card', id: 'route-dirs', ...(open ? { open: true } : {}) }, h('summary', null, t('navDirsTitle', { n: Math.max(0, n) })),
    h('ol', { class: 'dirlist' }, steps.map((s) => s.type === 'start'
      ? h('li', { 'data-step': 'start' }, turnIcon('straight'), h('div', null, h('b', null, t('navHead')), h('small', null, `${t('navTotal', { d: distText(total) })}${n === 0 ? ` · ${t('navNone')}` : ''}`)))
      : s.type === 'arrive' ? h('li', { 'data-step': 'arrive' }, turnIcon('arrive'), h('div', null, h('b', null, t('navArriveTxt')), h('small', null, t('navAfter', { d: distText(s.distM) }))))
      : h('li', { 'data-step': 'turn', 'data-dir': s.dir }, turnIcon(s.dir), h('div', null, h('b', null, turnText(s.dir)), h('small', null, t('navAfter', { d: distText(s.distM) })))))));
}
