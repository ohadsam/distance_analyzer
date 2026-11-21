// The weather service door: one GET to Open-Meteo with rounded coordinates (the route planner's services are in planApi.js, the update check in update.js).
// On by default (pref onlineWx; the person can turn it off), cached for an hour, bounded (8 s, 200 KB), credentials/referrer omitted; the answer is normalised in forecast.js.
import { forecastUrl, normalizeForecast, sanitizeHours, roundCoord, validCoords } from './forecast.js';
import { getPref, setPref, flag } from './store.js';

const TTL = 60 * 60000, STALE = 6 * 3600000, RETRY = 15 * 60000, MAX_BYTES = 200000, CACHE = 'da.wxc', PLACES = 'da.wxp', MAX_PLACES = 4;

let leaving = false; try { addEventListener('pagehide', () => { leaving = true; }); } catch { /* no window */ } // a request cut off because the page is closing or reloading is not a failure (it must not start the 15 minute pause)
export const onlineOn = () => flag('onlineWx'); // (the location permission is what decides whether it works)
export function getLoc() { try { const o = JSON.parse(getPref('loc', 'null')); return o && validCoords(o.lat, o.lon) ? { lat: roundCoord(o.lat), lon: roundCoord(o.lon) } : null; } catch { return null; } }
export function setLoc({ lat, lon }) { if (validCoords(lat, lon)) setPref('loc', JSON.stringify({ lat: roundCoord(lat), lon: roundCoord(lon) })); }
export function forgetWeather() { try { localStorage.removeItem('da.wxp'); } catch { /* ignore */ } setPref('onlineWx', '0'); setPref('wxPlace', 'null'); setPref('recoNotify', '0'); setPref('loc', 'null'); setPref('locAt', '0'); setPref('locFail', '0'); setPref('wxfail', '0'); try { localStorage.removeItem(CACHE); } catch { /* ignore */ } }

/** One-shot position (low accuracy is enough for weather). */
export const locate = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error('no geolocation'));
  navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }), rej, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
});

/**
 * The weather and the map need roughly where you are: with the location permission granted, the saved position (rounded) is refreshed quietly when it is missing or older than 6 hours.
 * Never asks by itself: the caller only calls it once the permission is granted. Returns the saved location (or null).
 */
export async function ensureLocation({ now = Date.now(), locateFn = locate } = {}) {
  if (!onlineOn()) return getLoc();
  if (getLoc() && now - (Number(getPref('locAt', '0')) || 0) < 6 * 3600000) return getLoc();
  if (now - (Number(getPref('locFail', '0')) || 0) < 30 * 60000) return getLoc(); // a failed try (no signal indoors) is not repeated at every focus
  try { setLoc(await locateFn()); setPref('locAt', String(now)); setPref('locFail', '0'); } catch { setPref('locFail', String(now)); /* what was saved stays */ }
  return getLoc();
}

/** The saved forecast (for the saved location) when it is younger than `maxAge`, else null. Never touches the network. */
export function cachedForecast(now = Date.now(), maxAge = STALE) {
  const loc = getLoc(); if (!loc) return null;
  try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && c.k === `${loc.lat},${loc.lon}` && now - c.at <= maxAge && Array.isArray(c.data) ? sanitizeHours(c.data) : null; } catch { return null; }
}
/** Fresh forecast (cache first). Returns { list, stale } or null when off/no location/no data. On a network failure the last saved one is returned as stale. */
export async function fetchForecast({ now = Date.now(), fetchFn = (...a) => fetch(...a), force = false } = {}) {
  const loc = getLoc(); if (!loc || !onlineOn()) return null;
  const fresh = force ? null : cachedForecast(now, TTL); if (fresh?.length) return { list: fresh, stale: false };
  const failedAt = Number(getPref('wxfail', '0')) || 0; // after a failure wait before asking again (an offline phone must not retry every tick)
  if (!force && failedAt && now - failedAt < RETRY) { const old = cachedForecast(now); return old?.length ? { list: old, stale: true } : null; }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetchFn(forecastUrl(loc.lat, loc.lon), { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (!r.ok) throw new Error(`http ${r.status}`);
    const text = await r.text(); if (text.length > MAX_BYTES) throw new Error('too large');
    const list = normalizeForecast(JSON.parse(text)); if (!list.length) throw new Error('empty');
    try { localStorage.setItem(CACHE, JSON.stringify({ k: `${loc.lat},${loc.lon}`, at: now, data: list })); } catch { /* storage blocked: no cache */ }
    setPref('wxfail', '0'); return { list, stale: false };
  } catch { if (!leaving) setPref('wxfail', String(now)); const old = cachedForecast(now); return old?.length ? { list: old, stale: true } : null; }
  finally { clearTimeout(timer); }
}

// ---- the forecast of ANY place (the weather screen: a searched place or a saved route's start). Its own small cache (4 places, 1 hour each), never mixed with the forecast of the saved position. ----
const placeKey = (loc) => `${roundCoord(loc.lat)},${roundCoord(loc.lon)}`;
const readPlaces = () => { try { const o = JSON.parse(localStorage.getItem(PLACES) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } };
/** The saved forecast of a place when it is younger than `maxAge`, else null. Never touches the network. */
export function cachedPlace(loc, now = Date.now(), maxAge = TTL) {
  if (!loc || !validCoords(loc.lat, loc.lon)) return null;
  const c = readPlaces()[placeKey(loc)]; return c && now - c.at <= maxAge && Array.isArray(c.data) ? sanitizeHours(c.data) : null;
}
/** Fresh forecast of a place { lat, lon } (cache first): { list, stale } or null (off, bad place, no data). Same safeguards as fetchForecast. */
export async function fetchPlace(loc, { now = Date.now(), fetchFn = (...a) => fetch(...a), force = false } = {}) {
  if (!onlineOn() || !loc || !validCoords(loc.lat, loc.lon)) return null;
  const fresh = force ? null : cachedPlace(loc, now); if (fresh?.length) return { list: fresh, stale: false };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetchFn(forecastUrl(loc.lat, loc.lon), { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (!r.ok) throw new Error(`http ${r.status}`);
    const text = await r.text(); if (text.length > MAX_BYTES) throw new Error('too large');
    const list = normalizeForecast(JSON.parse(text)); if (!list.length) throw new Error('empty');
    const all = readPlaces(); all[placeKey(loc)] = { at: now, data: list };
    const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_PLACES); try { localStorage.setItem(PLACES, JSON.stringify(Object.fromEntries(keep))); } catch { /* storage blocked: no cache */ }
    return { list, stale: false };
  } catch { const old = cachedPlace(loc, now, STALE); return old?.length ? { list: old, stale: true } : null; }
  finally { clearTimeout(timer); }
}
