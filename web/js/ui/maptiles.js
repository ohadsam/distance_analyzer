// The optional street-map background (off by default, see Settings). Tiles come from OpenStreetMap's public tile server: a request reveals the area being
// looked at, so it is opt-in. Pictures keep working without it (tile-less drawing); a tile that fails to load is simply not shown.
import { getPref } from '../store.js';
import { fitView, followView, tilesOf, ATTRIBUTION } from '../mapView.js';
import { projectTrack } from '../geo.js';
import { trackSvg } from '../icons.js';

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent?.append(e); return e; };
export const tilesOn = () => getPref('mapTiles', '0') === '1';

/** A <g> of tile images that are reused between updates (a tile is requested once, however often the view moves). */
export function createTileLayer() {
  const g = mk('g', { class: 'tiles', 'aria-hidden': 'true' }), cache = new Map();
  function show(tiles) {
    const keep = new Set();
    for (const t of tiles) {
      keep.add(t.key); let im = cache.get(t.key);
      if (!im) { im = mk('image', { href: t.url, preserveAspectRatio: 'none' }, g); im.addEventListener('error', () => im.setAttribute('visibility', 'hidden')); cache.set(t.key, im); }
      im.setAttribute('x', t.x.toFixed(1)); im.setAttribute('y', t.y.toFixed(1)); im.setAttribute('width', (t.w + 0.5).toFixed(1)); im.setAttribute('height', (t.h + 0.5).toFixed(1)); // +0.5: no hairline gaps between tiles
    }
    for (const [k, im] of cache) if (!keep.has(k)) { im.remove(); cache.delete(k); }
  }
  return { g, show };
}
export const attribution = (svg, w, h) => mk('text', { x: w - 4, y: h - 4, 'text-anchor': 'end', class: 'attrib' }, svg).append(ATTRIBUTION);

/** The picture of a finished track: on a street map when the person turned it on, else the plain drawing. */
export function trackPicture(points, w = 300, h = 180) {
  if (!tilesOn() || points.length < 2) return trackSvg(projectTrack(points, w, h), w, h);
  const step = Math.max(1, Math.ceil(points.length / 600)), pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const view = fitView(pts, w, h), layer = createTileLayer(); layer.show(tilesOf(view));
  const svg = trackSvg(pts.map((p) => view.toXY(p[0], p[1])), w, h); svg.prepend(layer.g); attribution(svg, w, h); svg.classList.add('on-map');
  return svg;
}
export { followView, tilesOf };
