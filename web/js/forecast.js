// Pure forecast helpers: the request URL (coordinates only, rounded) and a strict normaliser for the hourly answer of the weather service
// (Open-Meteo). Everything from the network is untrusted: only finite, clamped numbers survive. No fetch here (see weatherApi.js).
import { clamp } from './util.js';

export const API = 'https://api.open-meteo.com/v1/forecast';
export const HOURLY = ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'wind_speed_10m', 'uv_index', 'is_day'];
export const MAX_HOURS = 72;

/** Rounds a coordinate to 2 decimals (about 1 km): enough for weather, too coarse to identify a home. */
export const roundCoord = (n) => Math.round(clamp(Number(n), -180, 180) * 100) / 100;
export const validCoords = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

export function forecastUrl(lat, lon) {
  if (!validCoords(lat, lon)) throw new Error('bad coordinates');
  return `${API}?latitude=${roundCoord(lat)}&longitude=${roundCoord(lon)}&hourly=${HOURLY.join(',')}&forecast_days=3&timezone=auto`;
}

/** json -> [{ t (ms, hour start), temp, feels (deg C), rainP (0-100), rain (mm), wind (km/h), uv, day (bool) }], oldest first, bounded. */
export function normalizeForecast(json) {
  const h = json && typeof json === 'object' ? json.hourly : null;
  if (!h || !Array.isArray(h.time)) return [];
  const num = (a, i, lo, hi, d = 0) => (Array.isArray(a) && Number.isFinite(a[i]) ? clamp(a[i], lo, hi) : d);
  const out = [];
  for (let i = 0; i < Math.min(h.time.length, MAX_HOURS); i++) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00$/.exec(String(h.time[i])); if (!m) continue;
    const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4]).getTime(); if (!Number.isFinite(t)) continue;
    const temp = num(h.temperature_2m, i, -60, 60, NaN); if (!Number.isFinite(temp)) continue;
    out.push({ t, temp, feels: num(h.apparent_temperature, i, -70, 70, temp), rainP: num(h.precipitation_probability, i, 0, 100), rain: num(h.precipitation, i, 0, 200), wind: num(h.wind_speed_10m, i, 0, 250), uv: num(h.uv_index, i, 0, 20), day: Number(h.is_day?.[i]) === 1 });
  }
  return out;
}
