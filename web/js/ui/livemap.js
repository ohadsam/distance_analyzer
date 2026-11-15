// A small live map: the saved route to follow (dashed), the path so far, the start and the current position.
// Without the street-map option it is drawn without tiles and fits the whole path; with it, the map follows the person at a street-level zoom.
import { projectTrack } from '../geo.js';
import { tilesOn, createTileLayer, attribution, followView, tilesOf } from './maptiles.js';
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; };
const FOLLOW_ZOOM = 16;

export function liveMap({ w = 300, h = 150 } = {}) {
  const svg = mk('svg', { viewBox: `0 0 ${w} ${h}`, class: 'livemap', 'aria-hidden': 'true', focusable: 'false' });
  const layer = createTileLayer(), content = mk('g', {}); // the tile images stay; only the lines are redrawn
  svg.append(layer.g, content); let credited = false;
  /** points: [[lat, lon, t]] so far; route: [[lat, lon]] to follow (optional). Draws at most ~300 points of the track. */
  function update(points, route = []) {
    content.replaceChildren();
    const step = Math.max(1, Math.ceil(points.length / 300)), track = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    const onMap = tilesOn() && track.length > 0;
    if (!onMap) { layer.show([]); svg.classList.remove('on-map'); }
    if (onMap) {
      const me = track[track.length - 1], view = followView(me[0], me[1], FOLLOW_ZOOM, w, h);
      layer.show(tilesOf(view)); svg.classList.add('on-map'); if (!credited) { attribution(svg, w, h); credited = true; }
      const line = (ps, cls) => { if (ps.length > 1) mk('polyline', { points: ps.map((p) => view.toXY(p[0], p[1]).join(',')).join(' '), class: cls }, content); };
      line(route, 'route-line'); line(track, 'track-line');
      const s = view.toXY(track[0][0], track[0][1]), m = view.toXY(me[0], me[1]);
      mk('circle', { cx: s[0], cy: s[1], r: 5, class: 'track-start' }, content); mk('circle', { cx: m[0], cy: m[1], r: 7, class: 'me' }, content);
      return;
    }
    const all = [...route, ...track];
    if (all.length < 2) { mk('circle', { cx: w / 2, cy: h / 2, r: 7, class: 'me' }, content); return; }
    const xy = projectTrack(all, w, h, 14), r = xy.slice(0, route.length), t = xy.slice(route.length);
    if (r.length > 1) mk('polyline', { points: r.map((p) => p.join(',')).join(' '), class: 'route-line' }, content);
    if (t.length > 1) mk('polyline', { points: t.map((p) => p.join(',')).join(' '), class: 'track-line' }, content);
    if (t.length) { mk('circle', { cx: t[0][0], cy: t[0][1], r: 5, class: 'track-start' }, content); mk('circle', { cx: t[t.length - 1][0], cy: t[t.length - 1][1], r: 7, class: 'me' }, content); }
  }
  update([]); return { el: svg, update };
}
