// The route planner's network door (opt-in, pref planNet). Four public services, each GET/POST only on the person's tap, bounded (time + size), no cookies,
// no referrer: OpenStreetMap Nominatim (address -> place), FOSSGIS OSRM (walking routes), Open-Meteo (elevation), Overpass (street data near the route).
// What is sent: the address text typed, and coordinates along the candidate routes. Nothing else, no identifiers. Answers are normalised in routePlan.js.
import { getPref, setPref, flag } from './store.js';
import { parseNominatim, parseOsrm, parseElevation, elevationUrl, overpassQuery, parseOverpass } from './routePlan.js';

const MAX_BYTES = 3000000;
export const planNetOn = () => flag('planNet');
export const setPlanNet = (on) => setPref('planNet', on ? '1' : '0');

async function getJson(url, { ms = 15000, body = null, fetchFn = (...a) => fetch(...a) } = {}) {
  if (!planNetOn()) throw new Error('off');
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    const init = { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' };
    if (body) Object.assign(init, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const r = await fetchFn(url, init); if (!r.ok) throw new Error(`http ${r.status}`);
    const text = await r.text(); if (text.length > MAX_BYTES) throw new Error('too large');
    return JSON.parse(text);
  } finally { clearTimeout(timer); }
}
/** Address text -> up to 5 places. */
export async function geocode(q, lang = 'en') {
  const text = String(q || '').trim().slice(0, 120); if (text.length < 2) return [];
  return parseNominatim(await getJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=${lang === 'he' ? 'he' : 'en'}&q=${encodeURIComponent(text)}`));
}
/** A walking route through the points [[lat, lon], ...] -> { path, distanceM } or null. */
export async function route(points) {
  const coords = points.map((p) => `${p[1].toFixed(5)},${p[0].toFixed(5)}`).join(';');
  return parseOsrm(await getJson(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`));
}
/** Elevation along a path -> { elev } or null. */
export async function elevation(path) {
  const { pts, url } = elevationUrl(path); const e = parseElevation(await getJson(url), pts.length);
  return e ? { elev: e } : null;
}
/** Street data near a path -> { ways, crossings } or null. */
export async function tags(path) {
  const r = parseOverpass(await getJson('https://overpass-api.de/api/interpreter', { ms: 30000, body: `data=${encodeURIComponent(overpassQuery(path))}` }));
  return r.ways.length || r.crossings.length ? r : null;
}
export const api = { route, elevation, tags };
