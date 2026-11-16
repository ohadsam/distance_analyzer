// Draws a UI icon from the generated icon data (design/momentum). createElementNS only - no HTML parsing. Colour = currentColor.
import { ICONS } from './iconData.js';
import { FIGURES } from './figureData.js';
import { isDark } from './art.js';
const NS = 'http://www.w3.org/2000/svg';

function draw(parent, nodes) {
  for (const [tag, attrs, kids] of nodes) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (kids?.length) draw(el, kids);
    parent.append(el);
  }
}

/** A UI icon from the generated data (nested whitelisted elements; each icon carries its own fills and strokes, `currentColor` follows the text colour). */
export function icon(name, size = 24) {
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false', class: 'ico tier1-icon' })) svg.setAttribute(k, v);
  if (Object.hasOwn(ICONS, name)) draw(svg, ICONS[name]);
  return svg;
}

/**
 * Trail, the companion character (trail-idle / walk / run / cheer / rest / wave / focus / finish) or a gauge (gauge-speed / gauge-pace), drawn inline so the motion CSS can move its m-* parts.
 * The light or dark art follows the current look (refreshFigures re-draws them when it changes). `animate` adds the .anim-on hook.
 */
export function figure(name, size = 96, { animate = true } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  svg.dataset.fig = name; svg.setAttribute('class', `figure ${name.startsWith('gauge') ? 'gauge' : 'trail-companion'}${animate ? ' anim-on' : ''}`);
  if (name.startsWith('trail-')) svg.dataset.pose = name.slice(6); // the motion CSS picks the animation by pose
  paintFigure(svg); return svg;
}
function paintFigure(svg) {
  const f = FIGURES[`${svg.dataset.fig}-${isDark() ? 'dark' : 'light'}`]; if (!f) return;
  svg.setAttribute('viewBox', f.vb); svg.replaceChildren(); draw(svg, f.nodes);
}
export const refreshFigures = () => document.querySelectorAll('svg[data-fig]').forEach(paintFigure);
try { globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', refreshFigures); } catch { /* old browser */ }
/** Points a gauge or gauge glyph's needle: deg in [-120, 120] (the CSS rotates the m-needle part by --deg). */
export const setNeedle = (el, deg) => el?.style.setProperty('--deg', `${Math.max(-120, Math.min(120, Math.round(deg)))}deg`);

/** Track polyline (from geo.projectTrack) as an SVG with start/end markers; decorative, the numbers carry the meaning. */
export function trackSvg(xy, w = 300, h = 180) {
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: `0 0 ${w} ${h}`, class: 'track', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
  if (xy.length > 1) {
    const line = document.createElementNS(NS, 'polyline'); line.setAttribute('points', xy.map((p) => p.join(',')).join(' ')); line.setAttribute('class', 'track-line'); svg.append(line);
    for (const [p, cls] of [[xy[0], 'track-start'], [xy[xy.length - 1], 'track-end']]) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 5); c.setAttribute('class', cls); svg.append(c); }
  }
  return svg;
}
