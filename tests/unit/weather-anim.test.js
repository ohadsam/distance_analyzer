import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { conditionOf, known } from '../../web/js/weatherAnim.js';
import { WEATHER_ANIM } from '../../web/js/weatherAnimData.js';
import { normalizeForecast, sanitizeHours, skyAt, forecastUrl } from '../../web/js/forecast.js';
import { STR } from '../../web/js/i18n.js';

test('WMO codes map to the animated conditions; night only changes the three that have a night picture', () => {
  assert.equal(conditionOf(0, true), 'clear_day'); assert.equal(conditionOf(0, false), 'clear_night'); assert.equal(conditionOf(1, false), 'mostly_clear_night'); assert.equal(conditionOf(2, false), 'partly_cloudy_night');
  assert.equal(conditionOf(3, false), 'overcast_day', 'no night picture: the day one'); assert.equal(conditionOf(45, true), 'fog_day'); assert.equal(conditionOf(53, true), 'drizzle_day');
  assert.equal(conditionOf(63, true), 'rain_day'); assert.equal(conditionOf(65, true), 'heavy_rain_day'); assert.equal(conditionOf(82, true), 'heavy_rain_day'); assert.equal(conditionOf(66, true), 'freezing_rain_day');
  assert.equal(conditionOf(73, true), 'snow_day'); assert.equal(conditionOf(86, true), 'snow_day'); assert.equal(conditionOf(95, false), 'thunderstorm_day'); assert.equal(conditionOf(99, true), 'hail_day');
  for (const bad of [-1, 4, 10, 100, NaN, undefined, '0']) assert.equal(conditionOf(bad, true), null, `code ${bad}`);
  // every WMO code that Open-Meteo documents maps to a condition we have a picture for
  for (const c of [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]) for (const day of [true, false]) assert.ok(known(conditionOf(c, day)), `code ${c} day ${day}`);
});

test('every condition has its strip file, a name in both languages, and the strips stay small', () => {
  assert.equal(WEATHER_ANIM.conditions.length, 15); let total = 0;
  for (const c of WEATHER_ANIM.conditions) {
    const f = `web/art/weather-anim/${c}.webp`; assert.ok(existsSync(f), f); total += readFileSync(f).length;
    assert.ok(STR.en[`sky_${c}`] && STR.he[`sky_${c}`], `name of ${c} in both languages`);
  }
  assert.ok(total < 600 * 1024, `all strips ${Math.round(total / 1024)} KB (precached: keep them small)`);
});

test('forecast carries the weather code (clamped, -1 when missing) and skyAt finds the hour', () => {
  assert.match(forecastUrl(32.08, 34.79), /hourly=[^&]*weather_code/);
  const t0 = 1784084400, f = normalizeForecast({ hourly: { time: [t0, t0 + 3600, t0 + 7200], temperature_2m: [20, 21, 22], weather_code: [3, 250, 'x'], is_day: [1, 0, 1] } });
  assert.deepEqual(f.map((h) => h.code), [3, 99, -1]);
  assert.deepEqual(sanitizeHours([{ t: t0 * 1000, temp: 20, code: 61 }, { t: t0 * 1000 + 3600000, temp: 20, code: 'bad' }]).map((h) => h.code), [61, -1]);
  assert.deepEqual(skyAt(f, t0 * 1000 + 100), { tempC: 20, code: 3, day: true }); assert.equal(skyAt(f, t0 * 1000 + 7300000), null, 'an hour without a code has no sky'); assert.equal(skyAt(f, 5), null);
});

import { groupDays, startHour } from '../../web/js/ui/weather.js';
test('weather screen: hours group into local days (max 3) and the first hour shown is the current one, else midday', () => {
  const t0 = new Date(2026, 6, 15, 0, 0).getTime(), list = Array.from({ length: 72 }, (_, i) => ({ t: t0 + i * 3600000, temp: 20, code: 0, day: true, hum: 50, rain: 0, rainP: 0, wind: 5, uv: 1, feels: 20 }));
  const days = groupDays(list); assert.equal(days.length, 3); assert.equal(days[0].hours.length, 24);
  assert.equal(startHour(days[0], t0 + 9 * 3600000 + 5), 9, 'today: the current hour'); assert.equal(new Date(days[1].hours[startHour(days[1], t0 + 9 * 3600000)].t).getHours(), 12, 'another day: midday');
  assert.deepEqual(groupDays([]), []); assert.equal(groupDays(list.concat(list.map((x) => ({ ...x, t: x.t + 72 * 3600000 })))).length, 3, 'never more than three days');
});
test('forecast carries humidity (clamped, -1 when missing)', () => {
  assert.match(forecastUrl(32.08, 34.79), /relative_humidity_2m/);
  const t0 = 1784084400, f = normalizeForecast({ hourly: { time: [t0, t0 + 3600, t0 + 7200], temperature_2m: [20, 21, 22], relative_humidity_2m: [55, 140, null] } });
  assert.deepEqual(f.map((h) => h.hum), [55, 100, -1]); assert.deepEqual(sanitizeHours([{ t: t0 * 1000, temp: 20, hum: 'x' }, { t: t0 * 1000 + 3600000, temp: 20, hum: 61 }]).map((h) => h.hum), [-1, 61]);
});
