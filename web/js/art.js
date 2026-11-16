// Illustrations from the design kit (web/art/*): empty states, weather banners and the live-indication badges. Decorative: always alt="".
import { h } from './util.js';

export const isDark = () => { const th = document.documentElement.dataset.theme; return th === 'dark' || (th !== 'light' && !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches); };
/** An <img> of web/art/<group>/<name>-<light|dark>.svg for the current look. */
const src = (key) => `art/${key.split('/')[0]}/${key.split('/')[1]}-${isDark() ? 'dark' : 'light'}.svg`;
export const art = (group, name, cls = 'art') => h('img', { class: cls, src: src(`${group}/${name}`), 'data-art': `${group}/${name}`, alt: '', draggable: false });
/** Re-picks light/dark for every picture on screen (the system look changed at dusk, or the person chose a theme). */
export const refreshArt = () => document.querySelectorAll('img[data-art]').forEach((i) => { const s = src(i.dataset.art); if (i.getAttribute('src') !== s) i.setAttribute('src', s); });
try { globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', refreshArt); } catch { /* old browser */ }
/** An empty state: the picture and one calm sentence. */
export const emptyState = (name, text) => h('div', { class: 'empty' }, art('onboarding', name), h('p', { class: 'note' }, text));

const BADGE = { indLastNear: 'almost-distance', indLastPassed: 'passed-distance', indRecNear: 'almost-record', indRecPassed: 'new-record', indKmFaster: 'faster-last', indKmBest: 'fastest-km' };
/** The badge of a live indication key, or null. */
export const badgeFor = (key, cls = 'badge') => (BADGE[key] ? art('badges', BADGE[key], cls) : null);

/** Which weather banner fits a weather record { tempC, cond } (null -> none). */
export function bannerName(wx) {
  if (!wx || !Number.isFinite(wx.tempC)) return null;
  if (wx.cond === 'rain') return 'rain'; if (wx.cond === 'windy') return 'windy';
  return wx.tempC < 10 ? 'cold' : wx.tempC < 26 ? 'clear' : 'hot'; // the forecast has no cloud cover, so no "cloudy" scene is claimed
}
export const weatherBanner = (wx) => { const n = bannerName(wx); return n ? art('weather', n, 'art banner') : null; };
