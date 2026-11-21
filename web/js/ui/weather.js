// The weather screen: hour by hour for today and the next two days - sky, temperature, feels like, chance and amount of rain, humidity, wind, UV - for your position,
// a place you search for, or the start of a saved route; pick an hour to see its numbers. Uses the cached forecast first (one request an hour per place); times are the phone's.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { getPref, setPref, listRoutes } from '../store.js';
import { onlineOn, getLoc, fetchForecast, fetchPlace } from '../weatherApi.js';
import { planNetOn, setPlanNet, geocode } from '../planApi.js';
import { roundCoord, validCoords } from '../forecast.js';
import { conditionOf, weatherIcon } from '../weatherAnim.js';
import { barChart, lineChart } from '../charts.js';
import { hourDetail, hourLine } from './hourdetail.js';
import { progressBar } from './progress.js';

const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
/** Forecast hours -> [{ key, ms, hours }] one entry per local day, oldest first (at most 3). */
export function groupDays(list) {
  const days = []; for (const x of list) { const k = dayKey(x.t); let d = days[days.length - 1]; if (!d || d.key !== k) { d = { key: k, ms: x.t, hours: [] }; days.push(d); } d.hours.push(x); }
  return days.slice(0, 3);
}
/** The hour to show first: the current one for today, else midday (or the first hour that exists). */
export function startHour(day, now = Date.now()) { const cur = day.hours.findIndex((x) => now >= x.t && now < x.t + 3600000); if (cur >= 0) return cur; const noon = day.hours.findIndex((x) => new Date(x.t).getHours() === 12); return noon >= 0 ? noon : 0; }
const readPlace = () => { try { const o = JSON.parse(getPref('wxPlace', 'null')); if (o?.type === 'place' && validCoords(o.lat, o.lon)) return { type: 'place', name: String(o.name || '').slice(0, 80), lat: roundCoord(o.lat), lon: roundCoord(o.lon) }; if (o?.type === 'route' && /^r[a-z0-9]{3,24}$/.test(String(o.id))) return { type: 'route', id: o.id }; } catch { /* default */ } return { type: 'me' }; };

export function renderWeather() {
  let place = readPlace(), list = [], day = 0, hour = 0, routes = [], stale = false, status = 'loading', token = 0;
  const el = h('section', { class: 'weather' }), body = h('div', { class: 'wxbody', id: 'wx-body' }), msg = h('p', { class: 'note', role: 'status', id: 'wx-msg' });
  const hh = (ms) => String(new Date(ms).getHours()).padStart(2, '0');
  const dayName = (d, i) => (i === 0 ? t('wxToday') : i === 1 ? t('wxTomorrow') : new Date(d.ms).toLocaleDateString(getLang() === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long' }));

  async function where() { // the coordinates of the chosen place
    if (place.type === 'place') return { lat: place.lat, lon: place.lon, name: place.name };
    if (place.type === 'route') { const r = routes.find((x) => x.id === place.id); const p = r?.path?.[0]; return p && validCoords(p[0], p[1]) ? { lat: p[0], lon: p[1], name: r.name } : null; }
    const l = getLoc(); return l ? { ...l, name: '' } : null;
  }
  async function load(force = false) {
    const mine = ++token; status = 'loading'; paint();
    if (!onlineOn()) { status = 'off'; return paint(); }
    const loc = await where(); if (mine !== token) return; if (!loc) { status = place.type === 'me' ? 'noloc' : 'noplace'; return paint(); }
    const res = place.type === 'me' ? await fetchForecast({ force }) : await fetchPlace(loc, { force }); if (mine !== token) return;
    if (!res?.list?.length) { status = 'error'; return paint(); }
    list = res.list; stale = res.stale; status = 'ok'; const days = groupDays(list); day = Math.min(day, days.length - 1); hour = startHour(days[day]); paint();
  }
  const choose = (p) => { place = p; setPref('wxPlace', JSON.stringify(p)); day = 0; load(); };

  function placeBox() {
    const sel = h('select', { id: 'wx-place', 'aria-label': t('wxPlace'), onchange: (e) => { const v = e.target.value; if (v === 'me') choose({ type: 'me' }); else if (v.startsWith('r:')) choose({ type: 'route', id: v.slice(2) }); } },
      h('option', { value: 'me' }, t('wxMe')), ...routes.slice(0, 40).map((r) => h('option', { value: `r:${r.id}` }, `${t('wxRoute')}: ${r.name}`)), place.type === 'place' ? h('option', { value: 'p', selected: true }, place.name || t('wxPlaceOther')) : null);
    sel.value = place.type === 'me' ? 'me' : place.type === 'route' ? `r:${place.id}` : 'p';
    const q = h('input', { id: 'wx-q', type: 'search', placeholder: t('wxSearchPh'), 'aria-label': t('wxSearch'), maxlength: 80 }), results = h('div', { class: 'wxresults', id: 'wx-results' });
    const find = async () => {
      if (!planNetOn()) { setChildren(results, h('p', { class: 'note' }, t('wxSearchOff')), h('button', { type: 'button', class: 'btn', id: 'wx-allow', onclick: () => { setPlanNet(true); find(); } }, t('wxAllow'))); return; }
      setChildren(results, h('p', { class: 'note' }, t('wxLoading')));
      try { const r = await geocode(q.value, getLang()); setChildren(results, r.length ? r.map((p) => h('button', { type: 'button', class: 'btn ghost wxres', onclick: () => choose({ type: 'place', name: p.name.split(',').slice(0, 2).join(',').trim(), lat: roundCoord(p.lat), lon: roundCoord(p.lon) }) }, p.name.slice(0, 70))) : h('p', { class: 'note' }, t('planNoPlace'))); } catch { setChildren(results, h('p', { class: 'note' }, t('wxError'))); }
    };
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } });
    return h('div', { class: 'card wxplace' }, h('label', { for: 'wx-place' }, t('wxPlace')), sel, h('div', { class: 'row' }, q, h('button', { type: 'button', class: 'btn', id: 'wx-find', onclick: find }, t('wxFind'))), results);
  }

  function paint() {
    const parts = [placeBox()];
    if (status === 'loading') parts.push(h('div', { id: 'wx-loading' }, progressBar(t('wxLoading')).el));
    else if (status === 'off') parts.push(h('div', { class: 'card' }, h('p', null, t('wxOff')), h('button', { type: 'button', class: 'btn', id: 'wx-on', onclick: () => { setPref('onlineWx', '1'); load(); } }, t('wxTurnOn'))));
    else if (status === 'noloc') parts.push(h('div', { class: 'card' }, h('p', null, t('wxNoLoc')), h('a', { class: 'btn', href: '#/settings/s-perms' }, t('permTitle'))));
    else if (status === 'noplace') parts.push(h('p', { class: 'note', id: 'wx-noplace' }, t('wxNoPlace')));
    else if (status === 'error') parts.push(h('div', { class: 'card' }, h('p', null, t('wxError')), h('button', { type: 'button', class: 'btn', id: 'wx-retry', onclick: () => load(true) }, t('wxRetry'))));
    else {
      const days = groupDays(list), d = days[Math.min(day, days.length - 1)], hr = Math.min(hour, d.hours.length - 1);
      const temps = d.hours.map((z) => z.temp), lo = Math.round(Math.min(...temps)), hi = Math.round(Math.max(...temps)), total = d.hours.reduce((s, z) => s + z.rain, 0);
      parts.push(h('div', { class: 'chips', role: 'group', 'aria-label': t('wxDays') }, days.map((z, i) => h('button', { type: 'button', class: 'chip', 'data-day': i, 'aria-pressed': String(i === day), onclick: () => { day = i; hour = startHour(days[i]); paint(); } }, dayName(z, i)))));
      parts.push(h('p', { class: 'note', id: 'wx-summary' }, t('wxSummary', { lo, hi, mm: total.toFixed(1) }), stale ? ` ${t('wxStale')}` : ''));
      // picking an hour (a button, or a bar / point of a chart) updates the numbers in place: nothing is rebuilt, so the charts do not grow in again
      const holder = h('div', { id: 'wx-detail-holder' }), pickEl = h('p', { class: 'wxpick', id: 'wx-pick', role: 'status' }), labels = d.hours.map(hourLine);
      const buttons = d.hours.map((z, i) => h('button', { type: 'button', class: 'wxhour', 'data-hour': i, 'aria-pressed': String(i === hr), onclick: () => select(i) }, h('span', null, hh(z.t)), h('b', null, `${Math.round(z.temp)}°`)));
      const tempChart = lineChart(temps, { h: 90, onPick: (i) => select(i, true), labels, title: t('wxTempChart') }), rainChart = barChart(d.hours.map((z, i) => ({ v: z.rain, label: i % 3 === 0 ? hh(z.t) : '' })), { h: 90, onPick: (i) => select(i, true), labels, title: t('wxRainChart') });
      function select(i, fromChart = false) {
        hour = i; buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i))); setChildren(holder, hourDetail(d.hours[i])); pickEl.textContent = labels[i]; tempChart.select(i); rainChart.select(i);
        if (!fromChart) buttons[i].scrollIntoView({ inline: 'center', block: 'nearest' });
      }
      parts.push(h('div', { class: 'wxhours', role: 'group', 'aria-label': t('wxHourly'), id: 'wx-hours' }, buttons), holder, h('div', { class: 'wxcharts' }, h('h2', null, t('wxTempChart')), tempChart, h('h2', null, t('wxRainChart')), rainChart, pickEl, h('p', { class: 'note' }, t('wxChartHint'))));
      queueMicrotask(() => select(hr));
    }
    setChildren(body, parts);
  }
  setChildren(el, h('h1', null, t('wxTitle')), body, h('p', { class: 'note' }, t('wxNote')), msg);
  listRoutes().then((r) => { routes = r.filter((x) => Array.isArray(x.path) && x.path.length); paint(); }).catch(() => {});
  load(); paint();
  el.cleanup = () => { token++; };
  return el;
}
