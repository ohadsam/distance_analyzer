// Draws a UI icon from the generated icon data (design/momentum). createElementNS only - no HTML parsing. Colour = currentColor.
import { ICONS } from './iconData.js';
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
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false', class: 'ico' })) svg.setAttribute(k, v);
  if (Object.hasOwn(ICONS, name)) draw(svg, ICONS[name]);
  return svg;
}

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
