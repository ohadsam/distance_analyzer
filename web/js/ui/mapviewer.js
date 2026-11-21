// The full-screen interactive map: zoom in and out (buttons, wheel, pinch), drag, find an address, measure a distance by tapping points, automatic distance markers (every km),
// the numbered points marked during a workout, the turns of a route and, for a workout in progress, your position (`live`). Opened from every small map in the app.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { createMap, mk } from './imap.js';
import { kmMarkers } from '../mapView.js';
import { dist } from '../routePlan.js';
import { fmtKm } from '../format.js';
import { planNetOn, setPlanNet, geocode } from '../planApi.js';
import { locate } from '../weatherApi.js';
import { roundCoord } from '../forecast.js';
import { lineLength } from './mapScreen.js';

/** opts: { title, path: [[lat, lon, t?]], route: [[lat, lon]], marks: [{ n, lat, lon }], turns: [{ lat, lon, dir }], live: () => points } -> { close() }. */
export function openMapViewer({ title = '', path = [], route = [], marks = [], turns = [], live = null } = {}) {
  const dlg = h('dialog', { class: 'mapdlg', id: 'mapviewer', 'aria-labelledby': 'mv-title' });
  let me = null, pin = null, measuring = false, meas = [], follow = !!live, pts = path, timer = 0, rm = marks;
  const close = () => { clearInterval(timer); map.destroy(); if (dlg.open) dlg.close(); dlg.remove(); };
  const out = h('p', { class: 'mvinfo', id: 'mv-info', role: 'status' });
  const info = () => { const len = lineLength(pts.map((p) => [p[0], p[1]])); out.textContent = measuring ? `${t('mvMeasured')}: ${fmtKm(lineLength(meas))}${meas.length < 2 ? ` · ${t('mvTapPoints')}` : ''}` : len > 0 ? `${t('mvLength')}: ${fmtKm(len)}` : ''; };
  const map = createMap({
    zoom: 15,
    onTap: (ll) => { if (measuring) { meas.push([+ll[0].toFixed(6), +ll[1].toFixed(6)]); map.redraw(); info(); } },
    layers(view, g) {
      const xy = (p) => view.toXY(p[0], p[1]), line = (ps, cls) => { if (ps.length > 1) mk('polyline', { points: ps.map((p) => xy(p).map((n) => n.toFixed(1)).join(',')).join(' '), class: cls }, g); };
      line(route, 'route-line'); line(pts.length > 400 ? pts.filter((_, i) => i % Math.ceil(pts.length / 400) === 0 || i === pts.length - 1) : pts, 'track-line');
      for (const k of kmMarkers(route.length > 1 ? route : pts, dist)) { const [x, y] = xy([k.lat, k.lon]); mk('circle', { cx: x, cy: y, r: 11, class: 'kmdot' }, g); mk('text', { x, y: y + 4, class: 'kmtxt', 'text-anchor': 'middle' }, g).append(document.createTextNode(k.m >= 1000 ? (k.km % 1 ? k.km.toFixed(1) : String(k.km)) : String(Math.round(k.m)))); }
      for (const tn of turns) { const [x, y] = xy([tn.lat, tn.lon]); mk('circle', { cx: x, cy: y, r: 5, class: 'turndot' }, g); }
      const first = pts[0], last = pts[pts.length - 1];
      if (first) { const [x, y] = xy(first); mk('circle', { cx: x, cy: y, r: 6, class: 'track-start' }, g); }
      for (const m of rm) { const [x, y] = xy([m.lat, m.lon]); mk('circle', { cx: x, cy: y, r: 11, class: 'markdot' }, g); mk('text', { x, y: y + 4, class: 'marktxt', 'text-anchor': 'middle' }, g).append(document.createTextNode(String(m.n))); }
      line(meas, 'measure-line'); for (const p of meas) { const [x, y] = xy(p); mk('circle', { cx: x, cy: y, r: 4.5, class: 'wp' }, g); }
      const here = me || (live && last); if (here) { const [x, y] = xy(here); mk('circle', { cx: x, cy: y, r: 8, class: 'me' }, g); }
      if (pin) { const [x, y] = xy(pin); mk('path', { d: `M${x} ${y}l-7-16a8 8 0 1 1 14 0z`, class: 'pindrop' }, g); }
    },
  });
  // search a place
  const q = h('input', { id: 'mv-q', type: 'search', maxlength: 120, placeholder: t('mvSearchPh'), 'aria-label': t('mvSearch') }), results = h('div', { class: 'wxresults', id: 'mv-results' });
  async function find() {
    if (!planNetOn()) { setChildren(results, h('p', { class: 'note' }, t('wxSearchOff')), h('button', { type: 'button', class: 'btn', onclick: () => { setPlanNet(true); find(); } }, t('wxAllow'))); return; }
    setChildren(results, h('p', { class: 'note' }, t('wxLoading')));
    try { const r = await geocode(q.value, getLang()); setChildren(results, r.length ? r.map((p) => h('button', { type: 'button', class: 'btn ghost wxres', onclick: () => { pin = [roundCoord(p.lat), roundCoord(p.lon)]; map.set(p.lat, p.lon, 16); setChildren(results); } }, p.name.slice(0, 70))) : h('p', { class: 'note' }, t('planNoPlace'))); }
    catch { setChildren(results, h('p', { class: 'note' }, t('wxError'))); }
  }
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } });
  const btn = (id, ic, label, fn, pressed) => h('button', { type: 'button', id, class: 'btn ghost mapbtn', 'aria-label': label, ...(pressed != null ? { 'aria-pressed': String(pressed) } : {}), onclick: fn }, icon(ic, 22), h('span', null, label));
  const measureBtn = btn('mv-measure', 'route', t('mvMeasure'), () => { measuring = !measuring; if (!measuring) meas = []; measureBtn.setAttribute('aria-pressed', String(measuring)); map.redraw(); info(); }, false);
  const refit = () => { const all = [...route, ...pts].filter((p) => Number.isFinite(p[0])); if (all.length) map.fit(all); };
  const tools = h('div', { class: 'maptools mvtools', role: 'group', 'aria-label': t('mapTools') }, btn('mv-in', 'plus', t('mapZoomIn'), () => map.zoomBy(1)), btn('mv-out', 'minus', t('mapZoomOut'), () => map.zoomBy(-1)), btn('mv-fit', 'target', t('mvFit'), refit),
    btn('mv-me', 'gps', t('mapMyPlace'), async () => { try { const p = await locate(); me = [p.lat, p.lon]; map.set(p.lat, p.lon, Math.max(map.state.z, 16)); } catch { out.textContent = t('recoLocFail'); } }), measureBtn);
  setChildren(dlg, h('div', { class: 'mvhead' }, h('h2', { id: 'mv-title' }, title || t('mapTitle')), h('button', { type: 'button', class: 'btn', id: 'mv-close', onclick: close }, t('shareClose'))),
    h('div', { class: 'mvsearch' }, q, h('button', { type: 'button', class: 'btn ghost', id: 'mv-find', 'aria-label': t('search'), onclick: find }, icon('search', 22))), results, map.el, tools, out);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  document.body.append(dlg); dlg.showModal(); info();
  requestAnimationFrame(() => { refit(); if (live) tick(); });
  function tick() { const p = live(); if (Array.isArray(p) && p.length) { pts = p; const l = p[p.length - 1]; if (follow) map.set(l[0], l[1], Math.max(map.state.z, 16)); else map.redraw(); info(); } }
  if (live) { timer = setInterval(tick, 2000); map.svg.addEventListener('pointerdown', () => { follow = false; }); } // a touch on the map stops the following
  return { close, set marks(m) { rm = m; map.redraw(); } };
}
