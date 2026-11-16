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
