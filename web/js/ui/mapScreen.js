// The map screen (#/map): pan and zoom a map, tap to lay points and read the distance of the line you drew (measure a route before walking it),
// save it as a route, or start the route planner from the map's centre. Without the street-map option it draws a plain grid (no network at all).
import { h, setChildren } from '../util.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { getJson, setJson, setPref, listWorkouts, listRoutes, saveRoute } from '../store.js';
import { followView, tilesOf, MAX_Z, MIN_Z } from '../mapView.js';
import { createTileLayer, credit, tilesOn } from './maptiles.js';
import { dist } from '../routePlan.js';
import { makeRoute, MAX_ROUTES } from '../route.js';
import { fmtKm } from '../format.js';
import { locate } from '../weatherApi.js';
import { newRouteId } from './routes.js';

const NS = 'http://www.w3.org/2000/svg', W = 320, HT = 360, DEFAULT = { lat: 32.0853, lon: 34.7818, z: 14 };
const mk = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent?.append(e); return e; };
/** Pure: the length of the line through `pts` ([[lat, lon]]), in metres. */
export const lineLength = (pts) => { let m = 0; for (let i = 1; i < pts.length; i++) m += dist(pts[i - 1], pts[i]); return m; };
/** Pure: a "nice" scale-bar length (1, 2, 5 x 10^n metres) that fits in `maxM`. */
export function niceLength(maxM) { const p = 10 ** Math.floor(Math.log10(Math.max(1, maxM))); for (const m of [5, 2, 1]) if (m * p <= maxM) return m * p; return p; }

export function renderMap() {
  const saved = getJson('mapView', null);
  const st = { lat: saved?.lat ?? DEFAULT.lat, lon: saved?.lon ?? DEFAULT.lon, z: Math.min(MAX_Z, Math.max(MIN_Z, saved?.z ?? DEFAULT.z)), pts: [] };
  const svg = mk('svg', { viewBox: `0 0 ${W} ${HT}`, class: 'bigmap', role: 'application', tabindex: '0', 'aria-label': t('mapAria') });
  const layer = createTileLayer(), content = mk('g', {}); svg.append(layer.g, content);
  const note = credit(); const wrap = h('div', { class: 'mapwrap bigwrap' }, svg, note);
  const total = h('b', { class: 'measure-km', id: 'map-km', 'aria-live': 'polite' }), legsEl = h('span', { class: 'note' });
  const msg = h('p', { class: 'note', role: 'status', id: 'map-msg' }), tileBox = h('div', { class: 'maptiles' });
  let view = followView(st.lat, st.lon, st.z, W, HT), saveT = 0;

  function draw() {
    view = followView(st.lat, st.lon, st.z, W, HT); clearTimeout(saveT); saveT = setTimeout(() => setJson('mapView', { lat: +st.lat.toFixed(5), lon: +st.lon.toFixed(5), z: st.z }), 400); // not on every drag step
    content.replaceChildren(); const on = tilesOn(); layer.show(on ? tilesOf(view) : []); note.hidden = !on; svg.classList.toggle('on-map', on);
    if (!on) for (let i = 1; i < 8; i++) { mk('path', { d: `M${i * W / 8} 0V${HT}`, class: 'gridline' }, content); mk('path', { d: `M0 ${i * HT / 8}H${W}`, class: 'gridline' }, content); }
    const xy = st.pts.map((p) => view.toXY(p[0], p[1]));
    if (xy.length > 1) mk('path', { d: `M${xy.map((p) => p.join(' ')).join('L')}`, class: 'track-line' }, content);
    xy.forEach((p, i) => mk('circle', { cx: p[0], cy: p[1], r: i === 0 || i === xy.length - 1 ? 7 : 4.5, class: i === 0 ? 'track-start' : i === xy.length - 1 ? 'me' : 'wp' }, content));
    mk('path', { d: `M${W / 2 - 9} ${HT / 2}H${W / 2 + 9}M${W / 2} ${HT / 2 - 9}V${HT / 2 + 9}`, class: 'cross' }, content); // the centre: "Add point here" lands here
    const mpp = 40075016 * Math.cos(st.lat * Math.PI / 180) / view.scale, len = niceLength(mpp * 90), px = len / mpp, y = HT - 32;
    mk('path', { d: `M14 ${y - 4}V${y}H${14 + px}V${y - 4}`, class: 'scale' }, content); mk('text', { x: 14, y: y - 7, class: 'scale-t' }, content).append(document.createTextNode(len >= 1000 ? `${len / 1000} ${t('km')}` : `${len} m`));
    const m = lineLength(st.pts); total.textContent = fmtKm(m); legsEl.textContent = st.pts.length < 2 ? t('mapTapHint') : t('mapPoints', { n: st.pts.length, last: Math.round(dist(st.pts[st.pts.length - 2], st.pts[st.pts.length - 1])) });
    tilesNote();
  }
  function tilesNote() {
    setChildren(tileBox, tilesOn() ? null : h('div', { class: 'card' }, h('p', { class: 'note' }, t('mapTilesOff')), h('button', { type: 'button', class: 'btn ghost', id: 'map-tiles-on', onclick: () => { setPref('mapTiles', '1'); draw(); } }, t('mapTilesOn'))));
  }
  const addAt = (ll) => { if (st.pts.length >= 200) { msg.textContent = t('mapMax'); return; } st.pts.push([+ll[0].toFixed(6), +ll[1].toFixed(6)]); msg.textContent = ''; draw(); };
  const zoom = (d) => { st.z = Math.min(MAX_Z, Math.max(MIN_Z, st.z + d)); draw(); };
  const pan = (dx, dy) => { const c = followView(st.lat, st.lon, st.z, W, HT).fromXY(W / 2 + dx, HT / 2 + dy); st.lat = c[0]; st.lon = c[1]; draw(); };
  // drag = pan, tap = add a point
  let down = null;
  svg.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, moved: false }; svg.setPointerCapture?.(e.pointerId); });
  svg.addEventListener('pointermove', (e) => {
    if (!down) return; const r = svg.getBoundingClientRect(), k = W / r.width, dx = (e.clientX - down.x) * k, dy = (e.clientY - down.y) * k;
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) return; down.moved = true; down.x = e.clientX; down.y = e.clientY; pan(-dx, -dy);
  });
  svg.addEventListener('pointerup', (e) => { if (down && !down.moved) { const r = svg.getBoundingClientRect(); addAt(view.fromXY((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * HT / r.height)); } down = null; });
  svg.addEventListener('pointercancel', () => { down = null; });
  svg.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-60, 0], ArrowRight: [60, 0], ArrowUp: [0, -60], ArrowDown: [0, 60] }[e.key];
    if (k) { e.preventDefault(); pan(...k); } else if (e.key === '+' || e.key === '=') zoom(1); else if (e.key === '-') zoom(-1); else if (e.key === 'Enter') { e.preventDefault(); addAt([st.lat, st.lon]); }
  });
  const btn = (id, ic, label, fn, cls = 'btn ghost') => h('button', { type: 'button', id, class: `${cls} mapbtn`, 'aria-label': label, onclick: fn }, icon(ic, 22), h('span', null, label));
  const nameIn = h('input', { id: 'map-name', maxLength: 40, value: t('mapRouteName'), 'aria-label': t('routeNameLabel') });
  const el = h('section', { class: 'mapscreen' }, h('h1', null, t('mapTitle')), h('p', { class: 'note' }, t('mapIntro')), wrap, tileBox,
    h('div', { class: 'maptools', role: 'group', 'aria-label': t('mapTools') },
      btn('map-in', 'plus', t('mapZoomIn'), () => zoom(1)), btn('map-out', 'minus', t('mapZoomOut'), () => zoom(-1)),
      btn('map-me', 'gps', t('mapMyPlace'), async () => { msg.textContent = t('recoLocating'); try { const p = await locate(); st.lat = p.lat; st.lon = p.lon; if (st.z < 15) st.z = 16; msg.textContent = ''; draw(); } catch { msg.textContent = t('recoLocFail'); } })),
    h('div', { class: 'card measure' }, h('div', { class: 'row' }, h('span', null, t('mapDistance')), total), legsEl,
      h('div', { class: 'maptools' }, btn('map-add', 'pin', t('mapAddCentre'), () => addAt([st.lat, st.lon]), 'btn'),
        btn('map-undo', 'back', t('mapUndo'), () => { st.pts.pop(); draw(); }), btn('map-clear', 'trash', t('mapClear'), () => { st.pts = []; draw(); })),
      h('div', { class: 'field' }, h('label', { for: 'map-name' }, t('routeNameLabel')), nameIn),
      h('div', { class: 'maptools' }, btn('map-save', 'route', t('mapSave'), async () => {
        if (st.pts.length < 2) { msg.textContent = t('mapNeed2'); return; }
        if ((await listRoutes()).length >= MAX_ROUTES) { msg.textContent = t('planFull'); return; }
        const r = await saveRoute(makeRoute(st.pts, { id: newRouteId(), name: nameIn.value, oneTime: false })); msg.textContent = r ? t('mapSaved') : t('mapNeed2'); if (r) setTimeout(() => { location.hash = `#/r/${r.id}`; }, 700);
      }, 'btn'), h('a', { class: 'btn ghost mapbtn', id: 'map-plan', href: '#/routeplan', onclick: () => { setJson('planStart', { lat: +st.lat.toFixed(5), lon: +st.lon.toFixed(5) }); } }, icon('target', 22), h('span', null, t('mapPlanHere'))))),
    msg);
  draw();
  if (!saved) listWorkouts().then((rows) => { const w = rows.find((x) => x.points?.length); if (w && el.isConnected && !st.pts.length) { st.lat = w.points[0][0]; st.lon = w.points[0][1]; draw(); } }).catch(() => {});
  return el;
}
