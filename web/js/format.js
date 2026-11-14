// Pure formatting of workout numbers. Units come from i18n; a non-breaking space separates number and unit (Hebrew and English).
import { t } from './i18n.js';
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
