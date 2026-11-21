// "The sky now": the animated weather picture with the temperature and a short word, from the forecast already in the cache (never a request of its own).
import { h, setChildren } from '../util.js';
import { art } from '../art.js';
import { t } from '../i18n.js';
import { onlineOn, cachedForecast, fetchForecast, getLoc } from '../weatherApi.js';
import { skyAt } from '../forecast.js';
import { conditionOf, weatherIcon } from '../weatherAnim.js';

/** A small row (picture, "18°", "Partly cloudy") or null when online weather is off, nothing is cached or the hour has no known sky. */
export function skyNow(size = 64, now = Date.now()) {
  if (!onlineOn()) return null;
  const f = cachedForecast(now), sky = f?.length ? skyAt(f, now) : null, cond = sky ? conditionOf(sky.code, sky.day) : null, icon = cond ? weatherIcon(cond, size) : null;
  return icon ? h('a', { class: 'skynow', href: '#/weather', 'aria-label': `${t('skyNow')}: ${sky.tempC}°, ${t(`sky_${cond}`)}. ${t('wxOpen')}` }, icon, h('div', null, h('b', { class: 'skytemp' }, `${sky.tempC}°`), h('span', { class: 'skytext' }, t(`sky_${cond}`)))) : null;
}

/** A place for the sky row that fills itself: at once from the cache, else after the forecast arrives (one cached request an hour, only with online weather on and a known position). */
export function skySlot(size = 64, now = Date.now()) {
  const slot = h('div', { class: 'skyslot' }), fill = () => { const e = skyNow(size, now); if (e) setChildren(slot, e); return !!e; };
  if (!fill()) { // until the sky is known (or when it never will be: weather off, no position yet) the slot is still a clear door to the weather screen
    setChildren(slot, h('a', { class: 'skynow wxfallback', href: '#/weather' }, art('weather', 'clear', 'wxfb-img'), h('div', null, h('b', null, t('wxTitle')), h('span', { class: 'skytext' }, t('wxEntryHint')))));
    // the position may arrive a moment after Home is drawn (first launch): look again a few times, then leave it
    const attempt = (n) => {
      if (!slot.isConnected || !onlineOn()) return;
      const next = () => { if (n < 4 && slot.isConnected && !slot.querySelector('.wxa')) setTimeout(() => attempt(n + 1), 2000 * (n + 1)); };
      if (getLoc()) fetchForecast({ now: Date.now() }).then(() => { if (slot.isConnected && !fill()) next(); }).catch(next); else next();
    };
    setTimeout(() => attempt(0), 50); // (after the slot is on the page)
  }
  return slot;
}
