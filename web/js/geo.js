// Pure geography maths (no DOM, no storage, no clock): distance between GPS points. Points are {lat, lon}.
const R = 6371008.8; // mean Earth radius in metres
const rad = (d) => (d * Math.PI) / 180;

export const validPoint = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** Great-circle distance in metres. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Linear interpolation between two points (fine for the few metres between consecutive fixes). */
export const lerpPoint = (a, b, f) => ({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f });

/** Fits [lat, lon, t] points into a w x h box (equirectangular, aspect preserved) -> [[x, y], ...] for drawing a track without map tiles. */
export function projectTrack(points, w, h, pad = 8) {
  if (!points.length) return [];
  const lat0 = rad(points.reduce((s, p) => s + p[0], 0) / points.length), kx = Math.cos(lat0);
  const xs = points.map((p) => p[1] * kx), ys = points.map((p) => -p[0]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 1e-9), scale = (Math.min(w, h) - 2 * pad) / span;
  const ox = (w - (maxX - minX) * scale) / 2, oy = (h - (maxY - minY) * scale) / 2;
  return points.map((_, i) => [Math.round((ox + (xs[i] - minX) * scale) * 10) / 10, Math.round((oy + (ys[i] - minY) * scale) * 10) / 10]);
}
