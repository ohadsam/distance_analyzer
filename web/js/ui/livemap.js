// A small live map: the saved route to follow (dashed), the path so far, the start and the current position.
// Without the street-map option it is drawn without tiles and fits the whole path; with it, the map follows the person at a street-level zoom.
import { projectTrack, haversine } from '../geo.js';
import { t } from '../i18n.js';
import { h as html } from '../util.js'; // (`h` is the map height below)
import { tilesOn, createTileLayer, credit, followView, tilesOf } from './maptiles.js';
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; };
const FOLLOW_ZOOM = 16;

/** A scale bar ("50 m") so a short straight line still says how far it is. */
function scaleBar(g, pts, w, h) {
  const lats = pts.map((p) => p[0]), lons = pts.map((p) => p[1]), la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lons), lo1 = Math.max(...lons), mid = (la0 + la1) / 2;
  const spanM = Math.max(haversine({ lat: la0, lon: lo0 }, { lat: la1, lon: lo0 }), haversine({ lat: mid, lon: lo0 }, { lat: mid, lon: lo1 }), 1), pxPerM = (Math.min(w, h) - 28) / spanM;
  const nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000].filter((n) => n * pxPerM <= 90).pop(); if (!nice) return;
  const len = nice * pxPerM, y = h - 12;
  mk('path', { d: `M14 ${y - 4}V${y}H${14 + len}V${y - 4}`, class: 'scale' }, g); mk('text', { x: 14, y: y - 7, class: 'scale-t' }, g).append(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`);
}

export function liveMap({ w = 300, h = 150 } = {}) {
  const svg = mk('svg', { viewBox: `0 0 ${w} ${h}`, class: 'livemap', 'aria-hidden': 'true', focusable: 'false' });
  const layer = createTileLayer(), content = mk('g', {}); // the tile images stay; only the lines are redrawn
  svg.append(layer.g, content); const note = credit(); note.hidden = true; const legend = html('div', { class: 'maplegend', hidden: true }, html('span', { class: 'ld start' }), t('mapStart'), html('span', { class: 'ld me' }), t('mapYou')), hint = html('div', { class: 'maphint' }, t('mapHint')), el = html('div', { class: 'mapwrap' }, svg, note, legend, hint);
  /** points: [[lat, lon, t]] so far; route: [[lat, lon]] to follow (optional). Draws at most ~300 points of the track. */
  function update(points, route = [], marks = []) {
    content.replaceChildren();
    const step = Math.max(1, Math.ceil(points.length / 300)), track = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    legend.hidden = track.length < 2; hint.hidden = track.length > 0; // what the dots mean once there is a path; what the empty map is for before that
    const onMap = tilesOn() && track.length > 0;
    svg.setAttribute('preserveAspectRatio', onMap ? 'xMidYMid slice' : 'xMidYMid meet'); note.hidden = !onMap; // on a map the tiles fill the whole box, whatever its shape
    if (!onMap) { layer.show([]); svg.classList.remove('on-map'); }
    if (onMap) {
      const me = track[track.length - 1], view = followView(me[0], me[1], FOLLOW_ZOOM, w, h);
      layer.show(tilesOf(view)); svg.classList.add('on-map');
      const line = (ps, cls) => { if (ps.length > 1) mk('polyline', { points: ps.map((p) => view.toXY(p[0], p[1]).join(',')).join(' '), class: cls }, content); };
      line(route, 'route-line'); line(track, 'track-line');
      const s = view.toXY(track[0][0], track[0][1]), m = view.toXY(me[0], me[1]);
      mk('circle', { cx: s[0], cy: s[1], r: 5, class: 'track-start' }, content); mk('circle', { cx: m[0], cy: m[1], r: 7, class: 'me' }, content);
      for (const k of marks) pin(view.toXY(k.lat, k.lon), k.n);
      return;
    }
    const all = [...route, ...track, ...marks.map((k) => [k.lat, k.lon])];
    if (all.length < 2) { mk('circle', { cx: w / 2, cy: h / 2, r: 7, class: 'me' }, content); return; }
    const xy = projectTrack(all, w, h, 14), r = xy.slice(0, route.length), tr = xy.slice(route.length, route.length + track.length), mx = xy.slice(route.length + track.length);
    for (let k = 1; k < 6; k++) mk('line', { x1: (w * k) / 6, x2: (w * k) / 6, y1: 0, y2: h, class: 'gridline' }, content); for (let k = 1; k < 3; k++) mk('line', { x1: 0, x2: w, y1: (h * k) / 3, y2: (h * k) / 3, class: 'gridline' }, content); // a faint grid: a sense of space
    scaleBar(content, all, w, h);
    if (r.length > 1) mk('polyline', { points: r.map((p) => p.join(',')).join(' '), class: 'route-line' }, content);
    if (tr.length > 1) mk('polyline', { points: tr.map((p) => p.join(',')).join(' '), class: 'track-line' }, content);
    if (tr.length) { mk('circle', { cx: tr[0][0], cy: tr[0][1], r: 5, class: 'track-start' }, content); mk('circle', { cx: tr[tr.length - 1][0], cy: tr[tr.length - 1][1], r: 7, class: 'me' }, content); }
    mx.forEach((p, i) => pin(p, marks[i].n));
  }
  function pin(p, n) { mk('circle', { cx: p[0], cy: p[1], r: 9, class: 'markdot' }, content); mk('text', { x: p[0], y: p[1] + 3.5, class: 'marktxt', 'text-anchor': 'middle' }, content).append(String(n)); }
  update([]); return { el, update };
}
