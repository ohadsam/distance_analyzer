// The animated weather pictures (the illustrator's frames, cut by scripts/make-weather-sprites.py): WMO weather code + day/night -> one of 15 looping strips.
// Pure mapping (conditionOf) + one small element (a strip of 12 frames played with steps(), only while .anim-on: the calm switch and reduced motion stop it, see app.css).
import { h } from './util.js';
import { WEATHER_ANIM } from './weatherAnimData.js';

const NIGHT = new Set(['clear', 'mostly_clear', 'partly_cloudy']); // only these three exist at night; the others are the same by day and by night
/** WMO code (Open-Meteo) -> condition name, or null for an unknown code. */
export function conditionOf(code, day = true) {
  let c = null;
  if (code === 0) c = 'clear'; else if (code === 1) c = 'mostly_clear'; else if (code === 2) c = 'partly_cloudy'; else if (code === 3) c = 'overcast';
  else if (code === 45 || code === 48) c = 'fog';
  else if (code === 51 || code === 53 || code === 55) c = 'drizzle';
  else if (code === 56 || code === 57 || code === 66 || code === 67) c = 'freezing_rain';
  else if (code === 61 || code === 63 || code === 80 || code === 81) c = 'rain';
  else if (code === 65 || code === 82) c = 'heavy_rain';
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) c = 'snow';
  else if (code === 95) c = 'thunderstorm'; else if (code === 96 || code === 99) c = 'hail';
  if (!c) return null;
  return `${c}_${!day && NIGHT.has(c) ? 'night' : 'day'}`;
}
/** The strip's name for a condition (checked against the generated list), else null. */
export const known = (cond) => (WEATHER_ANIM.conditions.includes(cond) ? cond : null);

/** A looping weather picture, `size` px square. Decorative (alt=""). */
export function weatherIcon(cond, size = 72, { animate = true } = {}) {
  const c = known(cond); if (!c) return null;
  return h('span', { class: `wxa${animate ? ' anim-on' : ''}`, 'data-cond': c, 'aria-hidden': 'true', style: { 'inline-size': `${size}px`, 'block-size': `${size}px`, '--ms': `${WEATHER_ANIM.ms}ms`, '--n': String(WEATHER_ANIM.frames) } },
    h('img', { src: `art/weather-anim/${c}.webp`, alt: '', draggable: false, width: WEATHER_ANIM.size * WEATHER_ANIM.frames, height: WEATHER_ANIM.size }));
}
