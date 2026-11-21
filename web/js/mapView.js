// Pure map maths for the optional street-map background (Web Mercator, the standard "slippy map" tiles). Nothing here touches the network or the DOM.
export const TILE_PX = 256, MAX_Z = 19, MIN_Z = 2, MAX_TILES = 16;
export const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
export const ATTRIBUTION = '© OpenStreetMap';
const MIN_SPAN = 400 / 40075016; // never zoom in closer than about 400 m across (a short walk must not become one huge tile)

/** lat/lon -> world coordinates in [0, 1) (0,0 = top-left of the Mercator world). */
export function world(lat, lon) {
  const s = Math.sin(Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180);
  return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}

/**
 * A view of the map in a w x h box: `toXY(lat, lon)` gives the box position, `scale` is pixels per world unit.
 * fit: every point visible (aspect preserved, `pad` px margin). follow: centred on one point at a fixed zoom.
 */
export function fitView(points, w, h, pad = 12) {
  const ws = points.map((p) => world(p[0], p[1]));
  const xs = ws.map((p) => p[0]), ys = ws.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, MIN_SPAN), spanY = Math.max(maxY - minY, MIN_SPAN);
  const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return makeView(cx, cy, scale, w, h);
}
export function followView(lat, lon, zoom, w, h) {
  const [cx, cy] = world(lat, lon);
  return makeView(cx, cy, TILE_PX * 2 ** zoom, w, h);
}
/** World coordinates [0, 1) -> lat/lon (the inverse of `world`). */
export function unworld(x, y) { return [Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI, ((x * 360) % 360 + 360) % 360 - 180]; }
function makeView(cx, cy, scale, w, h) {
  return { cx, cy, scale, w, h, fromXY: (px, py) => unworld(cx + (px - w / 2) / scale, Math.min(0.999, Math.max(0.001, cy + (py - h / 2) / scale))), toXY: (lat, lon) => { const [x, y] = world(lat, lon); return [Math.round((w / 2 + (x - cx) * scale) * 10) / 10, Math.round((h / 2 + (y - cy) * scale) * 10) / 10]; } };
}

/** The tiles that cover the view: [{ key, url, x, y, w, h }] with box positions (floats), at the zoom whose tiles are about 128-256 px on screen. */
export function tilesOf(view) {
  let z = Math.max(MIN_Z, Math.min(MAX_Z, Math.ceil(Math.log2(view.scale / TILE_PX))));
  for (;;) {
    const n = 2 ** z, size = view.scale / n; // a tile's size in box px
    const left = view.cx - view.w / 2 / view.scale, right = view.cx + view.w / 2 / view.scale, top = view.cy - view.h / 2 / view.scale, bottom = view.cy + view.h / 2 / view.scale;
    const x0 = Math.floor(left * n), x1 = Math.floor(right * n), y0 = Math.max(0, Math.floor(top * n)), y1 = Math.min(n - 1, Math.floor(bottom * n));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES && z > MIN_Z) { z--; continue; }
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const wrapX = ((x % n) + n) % n;
      out.push({ key: `${z}/${x}/${y}`, url: TILE_URL(z, wrapX, y), x: view.w / 2 + (x / n - view.cx) * view.scale, y: view.h / 2 + (y / n - view.cy) * view.scale, w: size, h: size });
    }
    return out;
  }
}

/**
 * Where to put distance markers along a path: [{ km (the distance in km, may be 0.2, 0.5 ...), m (metres), lat, lon }]. The step follows the length - every 200 m on a very short path,
 * 500 m up to 3 km, then every kilometre (every 2 / 5 / 10 km when there would be more than ~40 markers). Pure; the end of the path is never marked twice.
 */
export function kmMarkers(path, lengthOf) {
  if (!Array.isArray(path) || path.length < 2) return [];
  const seg = [0]; for (let i = 1; i < path.length; i++) seg.push(seg[i - 1] + lengthOf(path[i - 1], path[i]));
  const total = seg[seg.length - 1]; if (!(total > 100)) return [];
  let step = total < 1200 ? 200 : total < 3000 ? 500 : 1000; for (const s of [2000, 5000, 10000, 20000]) if (total / step > 40) step = s;
  const out = []; let i = 1;
  for (let m = step; m <= total - 30; m += step) {
    while (i < path.length - 1 && seg[i] < m) i++;
    const a = path[i - 1], b = path[i], span = seg[i] - seg[i - 1] || 1, f = Math.min(1, Math.max(0, (m - seg[i - 1]) / span));
    out.push({ km: m / 1000, m, lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f });
  }
  return out;
}
/** Pure: a "nice" scale-bar length (1, 2, 5 x 10^n metres) that fits in `maxM`. */
export function niceLength(maxM) { const p = 10 ** Math.floor(Math.log10(Math.max(1, maxM))); for (const m of [5, 2, 1]) if (m * p <= maxM) return m * p; return p; }
/** The zoom level (fractional) at which `points` fit a w x h box, and the centre: { lat, lon, z }. */
export function fitZoom(points, w, h, pad = 24) {
  const v = fitView(points, w, h, pad); const [lat, lon] = unworld(v.cx, v.cy);
  return { lat, lon, z: Math.max(MIN_Z, Math.min(MAX_Z, Math.log2(v.scale / TILE_PX))) };
}
