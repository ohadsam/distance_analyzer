// "The sky now": the animated weather picture with the temperature and a short word, from the forecast already in the cache (never a request of its own).
import { h, setChildren } from '../util.js';
import { t } from '../i18n.js';
import { onlineOn, cachedForecast, fetchForecast, getLoc } from '../weatherApi.js';
import { skyAt } from '../forecast.js';
import { conditionOf, weatherIcon } from '../weatherAnim.js';

/** A small row (picture, "18°", "Partly cloudy") or null when online weather is off, nothing is cached or the hour has no known sky. */
export function skyNow(size = 64, now = Date.now()) {
  if (!onlineOn()) return null;
  const f = cachedForecast(now), sky = f?.length ? skyAt(f, now) : null, cond = sky ? conditionOf(sky.code, sky.day) : null, icon = cond ? weatherIcon(cond, size) : null;
  return icon ? h('div', { class: 'skynow', role: 'group', 'aria-label': `${t('skyNow')}: ${sky.tempC}°, ${t(`sky_${cond}`)}` }, icon, h('div', null, h('b', { class: 'skytemp' }, `${sky.tempC}°`), h('span', { class: 'skytext' }, t(`sky_${cond}`)))) : null;
}

/** A place for the sky row that fills itself: at once from the cache, else after the forecast arrives (one cached request an hour, only with online weather on and a known position). */
export function skySlot(size = 64, now = Date.now()) {
  const slot = h('div', { class: 'skyslot' }), fill = () => { const e = skyNow(size, now); if (e) setChildren(slot, e); return !!e; };
  if (!fill() && onlineOn() && getLoc()) fetchForecast({ now }).then(() => { if (slot.isConnected) fill(); }).catch(() => {});
  return slot;
}
