// A small live map drawn without map tiles: the saved route to follow (dashed), the path so far, the start and the current position.
// (Background map tiles need the internet; see ARCHITECTURE. The shape of the path and the dot are what matter while moving.)
import { projectTrack } from '../geo.js';
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; };

export function liveMap({ w = 300, h = 150 } = {}) {
  const svg = mk('svg', { viewBox: `0 0 ${w} ${h}`, class: 'livemap', 'aria-hidden': 'true', focusable: 'false' });
  /** points: [[lat, lon, t]] so far; route: [[lat, lon]] to follow (optional). Draws at most ~300 points of the track. */
  function update(points, route = []) {
    svg.replaceChildren();
    const step = Math.max(1, Math.ceil(points.length / 300)), track = points.filter((_, i) => i % step === 0 || i === points.length - 1), all = [...route, ...track];
    if (all.length < 2) { mk('circle', { cx: w / 2, cy: h / 2, r: 7, class: 'me' }, svg); return; }
    const xy = projectTrack(all, w, h, 14), r = xy.slice(0, route.length), t = xy.slice(route.length);
    if (r.length > 1) mk('polyline', { points: r.map((p) => p.join(',')).join(' '), class: 'route-line' }, svg);
    if (t.length > 1) mk('polyline', { points: t.map((p) => p.join(',')).join(' '), class: 'track-line' }, svg);
    if (t.length) { mk('circle', { cx: t[0][0], cy: t[0][1], r: 5, class: 'track-start' }, svg); mk('circle', { cx: t[t.length - 1][0], cy: t[t.length - 1][1], r: 7, class: 'me' }, svg); }
  }
  update([]); return { el: svg, update };
}
