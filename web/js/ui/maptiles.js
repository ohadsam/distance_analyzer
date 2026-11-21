// The optional street-map background (off by default, see Settings). Tiles come from OpenStreetMap's public tile server: a request reveals the area being
// looked at, so it is opt-in. Pictures keep working without it (tile-less drawing); a tile that fails to load is simply not shown.
import { h } from '../util.js';
import { flag } from '../store.js';
import { fitView, followView, tilesOf, ATTRIBUTION } from '../mapView.js';
import { projectTrack } from '../geo.js';
import { trackSvg, icon } from '../icons.js';
import { t } from '../i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent?.append(e); return e; };
export const tilesOn = () => flag('mapTiles');

/** A <g> of tile images that are reused between updates (a tile is requested once, however often the view moves). */
export function createTileLayer() {
  const g = mk('g', { class: 'tiles', 'aria-hidden': 'true' }), cache = new Map();
  function show(tiles) {
    const keep = new Set();
    for (const t of tiles) {
      keep.add(t.key); let im = cache.get(t.key);
      if (!im) { im = mk('image', { href: t.url, preserveAspectRatio: 'none' }, g); im.addEventListener('error', () => { im.remove(); setTimeout(() => { if (cache.get(t.key) === im) cache.delete(t.key); }, 20000); }); /* a failed tile is tried again after 20 s */ cache.set(t.key, im); }
      im.setAttribute('x', t.x.toFixed(1)); im.setAttribute('y', t.y.toFixed(1)); im.setAttribute('width', (t.w + 0.5).toFixed(1)); im.setAttribute('height', (t.h + 0.5).toFixed(1)); // +0.5: no hairline gaps between tiles
    }
    for (const [k, im] of cache) if (!keep.has(k)) { im.remove(); cache.delete(k); }
  }
  return { g, show };
}
/** The credit OpenStreetMap asks for: readable text with a link to its copyright page, over the map's corner (HTML, so it never scales with the picture). */
export const credit = () => h('a', { class: 'credit', href: 'https://www.openstreetmap.org/copyright', rel: 'noopener noreferrer' }, `${ATTRIBUTION} contributors`);

/**
 * The picture of a finished track: on a street map when the person turned it on, else the plain drawing; a button opens it as the full interactive map (zoom, measure, find an address).
 * opts: { marks: [{ n, lat, lon }] (the points marked during the workout), route: [[lat, lon]], turns, title }.
 */
export function trackPicture(points, w = 300, hgt = 180, { marks = [], route = [], turns = [], title = '' } = {}) {
  const step = Math.max(1, Math.ceil(points.length / 600)), pts = points.filter((_, i) => i % step === 0 || i === points.length - 1), mp = marks.map((m) => [m.lat, m.lon]);
  let svg, xy = (p) => p;
  if (!tilesOn() || points.length < 2) { const all = projectTrack([...pts, ...mp], w, hgt), n = pts.length; svg = trackSvg(all.slice(0, n), w, hgt); mp.forEach((_, k) => addMark(svg, all[n + k], marks[k].n)); }
  else { const view = fitView(pts, w, hgt), layer = createTileLayer(); layer.show(tilesOf(view)); svg = trackSvg(pts.map((p) => view.toXY(p[0], p[1])), w, hgt); svg.prepend(layer.g); svg.classList.add('on-map'); mp.forEach((p, k) => addMark(svg, view.toXY(p[0], p[1]), marks[k].n)); }
  const open = h('button', { type: 'button', class: 'mapexpand', 'aria-label': t('mvOpen'), onclick: () => import('./mapviewer.js').then((m) => m.openMapViewer({ title, path: points, route, marks, turns })) }, icon('plus', 22));
  return h('div', { class: 'mapwrap' }, svg, tilesOn() && points.length > 1 ? credit() : null, points.length > 1 ? open : null);
}
function addMark(svg, p, n) { if (!p) return; mk('circle', { cx: p[0], cy: p[1], r: 9, class: 'markdot' }, svg); mk('text', { x: p[0], y: p[1] + 3.5, class: 'marktxt', 'text-anchor': 'middle' }, svg).append(document.createTextNode(String(n))); }
export { followView, tilesOf };
