// The ONLY place the app talks to the internet: one GET to the weather service (Open-Meteo) with rounded coordinates, on the person's request.
// Opt-in (pref onlineWx), cached for an hour, bounded (8 s, 200 KB), credentials/referrer omitted; the answer is normalised in forecast.js.
import { forecastUrl, normalizeForecast, sanitizeHours, roundCoord, validCoords } from './forecast.js';
import { getPref, setPref } from './store.js';

const TTL = 60 * 60000, STALE = 6 * 3600000, RETRY = 15 * 60000, MAX_BYTES = 200000, CACHE = 'da.wxc', FAIL = 'da.wxfail';

export const onlineOn = () => getPref('onlineWx', '0') === '1';
export function getLoc() { try { const o = JSON.parse(getPref('loc', 'null')); return o && validCoords(o.lat, o.lon) ? { lat: roundCoord(o.lat), lon: roundCoord(o.lon) } : null; } catch { return null; } }
export function setLoc({ lat, lon }) { if (validCoords(lat, lon)) setPref('loc', JSON.stringify({ lat: roundCoord(lat), lon: roundCoord(lon) })); }
export function forgetWeather() { setPref('onlineWx', '0'); setPref('recoNotify', '0'); setPref('loc', 'null'); setPref('wxfail', '0'); try { localStorage.removeItem(CACHE); } catch { /* ignore */ } }

/** One-shot position (low accuracy is enough for weather). */
export const locate = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error('no geolocation'));
  navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }), rej, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
});

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
  } catch { setPref('wxfail', String(now)); const old = cachedForecast(now); return old?.length ? { list: old, stale: true } : null; }
  finally { clearTimeout(timer); }
}
