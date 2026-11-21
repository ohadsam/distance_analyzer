// The numbers of ONE forecast hour: the sky picture, temperature, feels like, humidity, chance and amount of rain, wind and UV. Shared by the weather screen and the Recommendations chart.
import { h } from '../util.js';
import { t } from '../i18n.js';
import { conditionOf, weatherIcon } from '../weatherAnim.js';

export const hourLabel = (ms) => `${String(new Date(ms).getHours()).padStart(2, '0')}:00`;
/** A card with every number of the hour `x` (an entry of the forecast list); `note` is an optional extra line (e.g. the comfort score). */
export function hourDetail(x, note = null) {
  const cond = x.code >= 0 ? conditionOf(x.code, x.day) : null, icon = cond ? weatherIcon(cond, 72) : null;
  const row = (k, v, id) => h('div', { class: 'wxrow', 'data-k': id }, h('dt', null, k), h('dd', null, v));
  return h('div', { class: 'card wxdetail', id: 'wx-detail', 'aria-live': 'polite' }, h('div', { class: 'wxhead' }, icon, h('div', null, h('b', { class: 'wxtemp' }, `${Math.round(x.temp)}°`), cond ? h('span', { class: 'skytext' }, t(`sky_${cond}`)) : null, h('small', null, hourLabel(x.t)))),
    h('dl', { class: 'wxrows' }, row(t('wxFeels'), `${Math.round(x.feels)}°`, 'feels'), row(t('wxHumidity'), x.hum >= 0 ? `${Math.round(x.hum)}%` : '–', 'hum'), row(t('wxRainP'), `${Math.round(x.rainP)}%`, 'rainp'), row(t('wxRain'), `${x.rain.toFixed(1)} ${t('wxMm')}`, 'rain'), row(t('wxWind'), `${Math.round(x.wind)} ${t('wxKmh')}`, 'wind'), row(t('wxUv'), String(Math.round(x.uv)), 'uv')), note);
}
/** One line with the hour's key numbers (for under a chart and for the chart's screen-reader labels). */
export const hourLine = (x) => `${hourLabel(x.t)} · ${Math.round(x.temp)}° · ${t('wxHumidity')} ${x.hum >= 0 ? `${Math.round(x.hum)}%` : '–'} · ${t('wxRain')} ${x.rain.toFixed(1)} ${t('wxMm')} (${Math.round(x.rainP)}%)`;
