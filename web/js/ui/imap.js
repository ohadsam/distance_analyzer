// The interactive map core: pan (drag), zoom (wheel, double click, pinch, buttons through zoomBy, keys +/-), tap callback, tiles when the street map is on (a plain grid otherwise),
// a scale bar and the credit. Overlays are drawn by the caller's `layers(view, g, { W, H, mk })` on every redraw. One pixel = one SVG unit (the viewBox follows the element's size).
import { h } from '../util.js';
import { t } from '../i18n.js';
import { followView, fitZoom, tilesOf, niceLength, MAX_Z, MIN_Z, TILE_PX } from '../mapView.js';
import { createTileLayer, credit as osmCredit, tilesOn } from './maptiles.js';

const NS = 'http://www.w3.org/2000/svg';
export const mk = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent?.append(e); return e; };
const clampZ = (z) => Math.min(MAX_Z, Math.max(MIN_Z, z));

/** opts: { lat, lon, zoom, onTap([lat, lon]), onView(state), layers(view, g, ctx) }. Returns { el, svg, state, view(), set(lat, lon, z), zoomBy(d), fit(points), redraw(), destroy() }. */
export function createMap({ lat = 32.0853, lon = 34.7818, zoom = 15, onTap, onView, layers } = {}) {
  const st = { lat, lon, z: clampZ(zoom) }; let W = 320, H = 360, view = followView(st.lat, st.lon, st.z, W, H);
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bigmap imapsvg', role: 'application', tabindex: '0', 'aria-label': t('mapAria') }), tiles = createTileLayer(), g = mk('g', {}); svg.append(tiles.g, g);
  const note = osmCredit(), el = h('div', { class: 'imap mapwrap' }, svg, note);
  function redraw() {
    view = followView(st.lat, st.lon, st.z, W, H); const on = tilesOn(); tiles.show(on ? tilesOf(view) : []); note.hidden = !on; svg.classList.toggle('on-map', on); g.replaceChildren();
    if (!on) for (let i = 1; i < 8; i++) { mk('path', { d: `M${i * W / 8} 0V${H}`, class: 'gridline' }, g); mk('path', { d: `M0 ${i * H / 8}H${W}`, class: 'gridline' }, g); }
    layers?.(view, g, { W, H, mk });
    const mpp = 40075016 * Math.cos(st.lat * Math.PI / 180) / view.scale, len = niceLength(mpp * 90), px = len / mpp, y = H - 30; // the scale bar
    mk('path', { d: `M14 ${y - 4}V${y}H${14 + px}V${y - 4}`, class: 'scale' }, g); mk('text', { x: 14, y: y - 7, class: 'scale-t' }, g).append(document.createTextNode(len >= 1000 ? `${len / 1000} ${t('km')}` : `${len} m`));
    onView?.(st);
  }
  const rectOf = () => svg.getBoundingClientRect(), at = (e) => { const r = rectOf(); return [e.clientX - r.left, e.clientY - r.top]; };
  /** Moves the centre so that the place `ll` appears at the screen position (px, py). */
  function anchorTo(ll, px, py) { const v = followView(st.lat, st.lon, st.z, W, H), [ax, ay] = v.toXY(ll[0], ll[1]), c = v.fromXY(W / 2 + (ax - px), H / 2 + (ay - py)); st.lat = c[0]; st.lon = c[1]; }
  const ptrs = new Map(); let drag = null, pinch = null;
  svg.addEventListener('pointerdown', (e) => {
    const [x, y] = at(e); ptrs.set(e.pointerId, { x, y }); try { svg.setPointerCapture?.(e.pointerId); } catch { /* a synthetic or finished pointer */ }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], mid = [(a.x + b.x) / 2, (a.y + b.y) / 2]; pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: st.z, ll: view.fromXY(mid[0], mid[1]) }; drag = null; }
    else if (ptrs.size === 1) drag = { x, y, ll: view.fromXY(x, y), moved: false };
  });
  svg.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return; const [x, y] = at(e); ptrs.set(e.pointerId, { x, y });
    if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1; st.z = clampZ(pinch.z0 + Math.log2(d / pinch.d0)); anchorTo(pinch.ll, (a.x + b.x) / 2, (a.y + b.y) / 2); redraw(); }
    else if (drag) { if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) < 8) return; drag.moved = true; anchorTo(drag.ll, x, y); redraw(); }
  });
  const up = (e, cancelled) => {
    const [x, y] = at(e); ptrs.delete(e.pointerId);
    if (drag && !drag.moved && !cancelled && ptrs.size === 0) onTap?.(view.fromXY(x, y));
    if (ptrs.size < 2) pinch = null; if (ptrs.size === 0) drag = null;
  };
  svg.addEventListener('pointerup', (e) => up(e, false)); svg.addEventListener('pointercancel', (e) => up(e, true));
  // a notch of a mouse wheel is ~100, a trackpad sends many small ones: the zoom follows deltaY
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const p = at(e), ll = view.fromXY(p[0], p[1]); st.z = clampZ(st.z - Math.max(-1, Math.min(1, e.deltaY / 300))); anchorTo(ll, p[0], p[1]); redraw(); }, { passive: false });
  svg.addEventListener('dblclick', (e) => { e.preventDefault(); const p = at(e), ll = view.fromXY(p[0], p[1]); st.z = clampZ(st.z + 1); anchorTo(ll, p[0], p[1]); redraw(); });
  svg.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-60, 0], ArrowRight: [60, 0], ArrowUp: [0, -60], ArrowDown: [0, 60] }[e.key];
    if (k) { e.preventDefault(); const c = view.fromXY(W / 2 + k[0], H / 2 + k[1]); st.lat = c[0]; st.lon = c[1]; redraw(); } else if (e.key === '+' || e.key === '=') api.zoomBy(1); else if (e.key === '-') api.zoomBy(-1); else if (e.key === 'Enter' && onTap) { e.preventDefault(); onTap([st.lat, st.lon]); } // Enter taps the centre (keyboard users)
  });
  let ro = null; if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => { const r = rectOf(); if (r.width > 10 && r.height > 10 && (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1)) { W = r.width; H = r.height; svg.setAttribute('viewBox', `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`); redraw(); } }); ro.observe(svg); }
  const api = {
    el, svg, state: st, view: () => view, redraw,
    set(la, lo, z) { st.lat = la; st.lon = lo; if (z != null) st.z = clampZ(z); redraw(); },
    zoomBy(d) { st.z = clampZ(st.z + d); redraw(); },
    fit(points) { if (!points.length) return; const f = fitZoom(points, W, H); api.set(f.lat, f.lon, points.length > 1 ? f.z : Math.max(f.z, 16)); },
    destroy() { ro?.disconnect(); },
  };
  redraw(); return api;
}
export { TILE_PX };
