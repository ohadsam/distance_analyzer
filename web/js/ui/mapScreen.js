// The map screen (#/map): an interactive map (drag, wheel / pinch / buttons to zoom, find an address) where you tap or press "Add point" to lay points and read the distance of the line
// you drew (measure a route before walking it), with distance markers every km; save it as a route, or start the route planner from the map's centre.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { getJson, setJson, setPref, listWorkouts, listRoutes, saveRoute } from '../store.js';
import { niceLength, kmMarkers, MAX_Z, MIN_Z } from '../mapView.js';
import { tilesOn } from './maptiles.js';
import { createMap, mk } from './imap.js';
import { dist } from '../routePlan.js';
import { makeRoute, MAX_ROUTES } from '../route.js';
import { fmtKm } from '../format.js';
import { locate } from '../weatherApi.js';
import { planNetOn, setPlanNet, geocode } from '../planApi.js';
import { roundCoord } from '../forecast.js';
import { newRouteId } from './routes.js';

const DEFAULT = { lat: 32.0853, lon: 34.7818, z: 14 };
/** Pure: the length of the line through `pts` ([[lat, lon]]), in metres. */
export const lineLength = (pts) => { let m = 0; for (let i = 1; i < pts.length; i++) m += dist(pts[i - 1], pts[i]); return m; };
export { niceLength };

export function renderMap() {
  const saved = getJson('mapView', null), pts = []; let pin = null, saveT = 0;
  const total = h('b', { class: 'measure-km', id: 'map-km', 'aria-live': 'polite' }), legsEl = h('span', { class: 'note' }), msg = h('p', { class: 'note', role: 'status', id: 'map-msg' }), tileBox = h('div', { class: 'maptiles' });
  const map = createMap({
    lat: saved?.lat ?? DEFAULT.lat, lon: saved?.lon ?? DEFAULT.lon, zoom: Math.min(MAX_Z, Math.max(MIN_Z, saved?.z ?? DEFAULT.z)), onTap: (ll) => addAt(ll),
    onView: (st) => { clearTimeout(saveT); saveT = setTimeout(() => setJson('mapView', { lat: +st.lat.toFixed(5), lon: +st.lon.toFixed(5), z: Math.round(st.z * 10) / 10 }), 400); },
    layers(view, g) {
      const xy = pts.map((p) => view.toXY(p[0], p[1]));
      if (xy.length > 1) mk('path', { d: `M${xy.map((p) => p.join(' ')).join('L')}`, class: 'track-line' }, g);
      for (const k of kmMarkers(pts, dist)) { const [x, y] = view.toXY(k.lat, k.lon); mk('circle', { cx: x, cy: y, r: 11, class: 'kmdot' }, g); mk('text', { x, y: y + 4, class: 'kmtxt', 'text-anchor': 'middle' }, g).append(document.createTextNode(k.m >= 1000 ? (k.km % 1 ? k.km.toFixed(1) : String(k.km)) : String(Math.round(k.m)))); }
      xy.forEach((p, i) => mk('circle', { cx: p[0], cy: p[1], r: i === 0 || i === xy.length - 1 ? 7 : 4.5, class: i === 0 ? 'track-start' : i === xy.length - 1 ? 'me' : 'wp' }, g));
      mk('path', { d: `M${view.w / 2 - 9} ${view.h / 2}H${view.w / 2 + 9}M${view.w / 2} ${view.h / 2 - 9}V${view.h / 2 + 9}`, class: 'cross' }, g); // the centre: "Add point here" lands here
      if (pin) { const [x, y] = view.toXY(pin[0], pin[1]); mk('path', { d: `M${x} ${y}l-7-16a8 8 0 1 1 14 0z`, class: 'pindrop' }, g); }
    },
  });
  const wrap = map.el; wrap.classList.add('bigwrap');
  function update() { const m = lineLength(pts); total.textContent = fmtKm(m); legsEl.textContent = pts.length < 2 ? t('mapTapHint') : t('mapPoints', { n: pts.length, last: Math.round(dist(pts[pts.length - 2], pts[pts.length - 1])) }); map.redraw(); tilesNote(); }
  function tilesNote() { setChildren(tileBox, tilesOn() ? null : h('div', { class: 'card' }, h('p', { class: 'note' }, t('mapTilesOff')), h('button', { type: 'button', class: 'btn ghost', id: 'map-tiles-on', onclick: () => { setPref('mapTiles', '1'); update(); } }, t('mapTilesOn')))); }
  const addAt = (ll) => { if (pts.length >= 200) { msg.textContent = t('mapMax'); return; } pts.push([+ll[0].toFixed(6), +ll[1].toFixed(6)]); msg.textContent = ''; update(); };
  // find an address
  const q = h('input', { id: 'map-q', type: 'search', maxlength: 120, placeholder: t('mvSearchPh'), 'aria-label': t('mvSearch') }), results = h('div', { class: 'wxresults', id: 'map-results' });
  async function find() {
    if (!planNetOn()) { setChildren(results, h('p', { class: 'note' }, t('wxSearchOff')), h('button', { type: 'button', class: 'btn', id: 'map-allow', onclick: () => { setPlanNet(true); find(); } }, t('wxAllow'))); return; }
    setChildren(results, h('p', { class: 'note' }, t('wxLoading')));
    try { const r = await geocode(q.value, getLang()); setChildren(results, r.length ? r.map((p) => h('button', { type: 'button', class: 'btn ghost wxres', onclick: () => { pin = [roundCoord(p.lat), roundCoord(p.lon)]; map.set(p.lat, p.lon, 16); setChildren(results); } }, p.name.slice(0, 70))) : h('p', { class: 'note' }, t('planNoPlace'))); }
    catch { setChildren(results, h('p', { class: 'note' }, t('wxError'))); }
  }
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } });
  const btn = (id, ic, label, fn, cls = 'btn ghost') => h('button', { type: 'button', id, class: `${cls} mapbtn`, 'aria-label': label, onclick: fn }, icon(ic, 22), h('span', null, label));
  const nameIn = h('input', { id: 'map-name', maxLength: 40, value: t('mapRouteName'), 'aria-label': t('routeNameLabel') });
  const centre = () => [map.state.lat, map.state.lon];
  const el = h('section', { class: 'mapscreen' }, h('h1', null, t('mapTitle')), h('p', { class: 'note' }, t('mapIntro')),
    h('div', { class: 'mvsearch' }, q, h('button', { type: 'button', class: 'btn ghost', id: 'map-find', 'aria-label': t('search'), onclick: find }, icon('search', 22))), results, wrap, tileBox, h('p', { class: 'note' }, t('mvKmNote')),
    h('div', { class: 'maptools', role: 'group', 'aria-label': t('mapTools') },
      btn('map-in', 'plus', t('mapZoomIn'), () => map.zoomBy(1)), btn('map-out', 'minus', t('mapZoomOut'), () => map.zoomBy(-1)),
      btn('map-me', 'gps', t('mapMyPlace'), async () => { msg.textContent = t('recoLocating'); try { const p = await locate(); map.set(p.lat, p.lon, Math.max(map.state.z, 16)); msg.textContent = ''; } catch { msg.textContent = t('recoLocFail'); } })),
    h('div', { class: 'card measure' }, h('div', { class: 'row' }, h('span', null, t('mapDistance')), total), legsEl,
      h('div', { class: 'maptools' }, btn('map-add', 'pin', t('mapAddCentre'), () => addAt(centre()), 'btn'),
        btn('map-undo', 'back', t('mapUndo'), () => { pts.pop(); update(); }), btn('map-clear', 'trash', t('mapClear'), () => { pts.length = 0; update(); })),
      h('div', { class: 'field' }, h('label', { for: 'map-name' }, t('routeNameLabel')), nameIn),
      h('div', { class: 'maptools' }, btn('map-save', 'route', t('mapSave'), async () => {
        if (pts.length < 2) { msg.textContent = t('mapNeed2'); return; }
        if ((await listRoutes()).length >= MAX_ROUTES) { msg.textContent = t('planFull'); return; }
        const r = await saveRoute(makeRoute(pts, { id: newRouteId(), name: nameIn.value, oneTime: false })); msg.textContent = r ? t('mapSaved') : t('mapNeed2'); if (r) setTimeout(() => { location.hash = `#/r/${r.id}`; }, 700);
      }, 'btn'), h('a', { class: 'btn ghost mapbtn', id: 'map-plan', href: '#/routeplan', onclick: () => { setJson('planStart', { lat: +map.state.lat.toFixed(5), lon: +map.state.lon.toFixed(5) }); } }, icon('target', 22), h('span', null, t('mapPlanHere'))))),
    msg);
  el.cleanup = () => map.destroy(); update();
  if (!saved) listWorkouts().then((rows) => { const w = rows.find((x) => x.points?.length); if (w && el.isConnected && !pts.length) map.set(w.points[0][0], w.points[0][1]); }).catch(() => {});
  return el;
}
