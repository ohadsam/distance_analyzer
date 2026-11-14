// Pure formatting of workout numbers. Units come from i18n; a non-breaking space separates number and unit (Hebrew and English).
import { t, STR } from './i18n.js';
import { weatherBucket } from './stats.js';
const p2 = (n) => String(n).padStart(2, '0');

/** 3725000 ms -> "1:02:05", 330000 -> "5:30". */
export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${p2(m)}:${p2(s % 60)}` : `${m}:${p2(s % 60)}`;
}
/** metres -> "3.21 km" (always two decimals: the width stays steady while running). */
export const fmtKm = (m) => `${(Math.max(0, m) / 1000).toFixed(2)} ${t('km')}`;
/** seconds per km -> "5:33" (empty dash when unknown or absurd). */
export function fmtPace(sec) {
  if (!(sec > 0 && sec < 5999)) return '–:––';
  const r = Math.round(sec); return `${Math.floor(r / 60)}:${p2(r % 60)}`;
}
export const fmtPaceUnit = (sec) => `${fmtPace(sec)} ${t('perKm')}`;
export const fmtDate = (ms, lang) => new Date(ms).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', weekday: 'short' });

const BUCKET_KEY = { cold: 'wxCold', cool: 'wxCool', mild: 'wxMild', hot: 'wxHot', rain: 'wxRain', none: 'wxNone' };
/** Everything a person might type to find a workout, in Hebrew AND English: kind, distance, date, month, weather. */
export function workoutText(w) {
  const d = new Date(w.startedAt), km = (w.distanceM / 1000).toFixed(2), both = (k) => `${STR.en[k]} ${STR.he[k]}`;
  const b = weatherBucket(w.weather);
  return [both(w.kind), km, `${km} km`, `${km} ${STR.he.km}`, d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', weekday: 'long' }), d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', weekday: 'long' }), d.getFullYear(),
    b === 'none' ? '' : both(BUCKET_KEY[b]), w.weather ? `${Math.round(w.weather.tempC)}` : ''].join(' ');
}
export const bucketLabel = (b) => t(BUCKET_KEY[b] || 'wxNone');
