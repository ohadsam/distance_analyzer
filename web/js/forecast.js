// Pure forecast helpers: the request URL (coordinates only, rounded) and a strict normaliser for the hourly answer of the weather service
// (Open-Meteo). Everything from the network is untrusted: only finite, clamped numbers survive. No fetch here (see weatherApi.js).
import { clamp } from './util.js';

export const API = 'https://api.open-meteo.com/v1/forecast';
export const HOURLY = ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'wind_speed_10m', 'uv_index', 'is_day', 'weather_code'];
export const MAX_HOURS = 72;

/** Rounds a coordinate to 2 decimals (about 1 km): enough for weather, too coarse to identify a home. */
export const roundCoord = (n) => Math.round(clamp(Number(n), -180, 180) * 100) / 100;
export const validCoords = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

export function forecastUrl(lat, lon) {
  if (!validCoords(lat, lon)) throw new Error('bad coordinates');
  return `${API}?latitude=${roundCoord(lat)}&longitude=${roundCoord(lon)}&hourly=${HOURLY.join(',')}&forecast_days=3&timezone=GMT&timeformat=unixtime`; // GMT + epoch seconds: no timezone or DST confusion between the place and the phone
}

/** json -> [{ t (ms, hour start), temp, feels (deg C), rainP (0-100), rain (mm), wind (km/h), uv, day (bool), code (WMO weather code 0-99, -1 = unknown) }], oldest first, bounded. */
export function normalizeForecast(json) {
  const h = json && typeof json === 'object' ? json.hourly : null;
  if (!h || !Array.isArray(h.time)) return [];
  const num = (a, i, lo, hi, d = 0) => (Array.isArray(a) && Number.isFinite(a[i]) ? clamp(a[i], lo, hi) : d);
  const out = [];
  for (let i = 0; i < Math.min(h.time.length, MAX_HOURS); i++) {
    const t = Number.isFinite(h.time[i]) ? Math.floor(h.time[i] / 3600) * 3600000 : NaN; if (!(t > 1e12 && t < 4e12)) continue; // epoch seconds -> the start of that hour
    const temp = num(h.temperature_2m, i, -60, 60, NaN); if (!Number.isFinite(temp)) continue;
    out.push({ t, temp, feels: num(h.apparent_temperature, i, -70, 70, temp), rainP: num(h.precipitation_probability, i, 0, 100), rain: num(h.precipitation, i, 0, 200), wind: num(h.wind_speed_10m, i, 0, 250), uv: num(h.uv_index, i, 0, 20), day: Number(h.is_day?.[i]) === 1, code: Number.isInteger(h.weather_code?.[i]) ? clamp(h.weather_code[i], 0, 99) : -1 });
  }
  return out;
}

/** A list read back from our own cache -> only valid, clamped hours (the cache is storage, so it is untrusted too). */
export function sanitizeHours(list) {
  if (!Array.isArray(list)) return [];
  const n = (v, lo, hi) => (Number.isFinite(v) ? clamp(v, lo, hi) : 0);
  return list.slice(0, MAX_HOURS).filter((h) => h && Number.isFinite(h.t) && h.t > 1e12 && h.t < 4e12 && Number.isFinite(h.temp)).map((h) => ({ t: h.t, temp: clamp(h.temp, -60, 60), feels: n(h.feels, -70, 70), rainP: n(h.rainP, 0, 100), rain: n(h.rain, 0, 200), wind: n(h.wind, 0, 250), uv: n(h.uv, 0, 20), day: h.day === true, code: Number.isInteger(h.code) ? clamp(h.code, -1, 99) : -1 }));
}

/** The weather during a workout from a forecast list: { tempC, cond } of the hour containing `ts`, or null when the list does not cover it. */
export function weatherAt(list, ts) {
  const h = list.find((x) => ts >= x.t && ts < x.t + 3600000); return h ? weatherOfHour(h) : null;
}
/** One forecast hour as the weather record of a workout: { tempC, cond }. */
export const weatherOfHour = (h) => ({ tempC: Math.round(h.temp), cond: h.rain > 0.2 || h.rainP >= 60 ? 'rain' : h.wind >= 30 ? 'windy' : 'clear' });

/** The sky now: { tempC, code, day } of the hour containing `ts`, or null when the list does not cover it or has no weather code. */
export function skyAt(list, ts) {
  const h = list.find((x) => ts >= x.t && ts < x.t + 3600000); return h && h.code >= 0 ? { tempC: Math.round(h.temp), code: h.code, day: h.day } : null;
}
