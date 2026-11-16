// The route planner (#/routeplan): a start address, the distance wanted and an end address (or back to the start) -> several different routes nearby,
// ranked by how well they fit the request (distance first, then climb, road crossings, sidewalks and trails). Needs the person's OK to use online
// services (planApi.js); nothing is sent before that. Saved routes join the normal routes list and can be followed with the usual workout screen.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { getJson, setJson, getNum, setPref, listRoutes, saveRoute } from '../store.js';
import { planNetOn, setPlanNet, geocode, api } from '../planApi.js';
import { planRoutes } from '../planner.js';
import { DEFAULT_PREFS, MIN_TARGET_M, MAX_TARGET_M } from '../routePlan.js';
import { makeRoute, MAX_ROUTES } from '../route.js';
import { fmtKm } from '../format.js';
import { locate } from '../weatherApi.js';
import { trackPicture } from './maptiles.js';
import { newRouteId } from './routes.js';

const NS = 'http://www.w3.org/2000/svg';
const PREFS = { hills: ['any', 'flat', 'hilly'], crossings: ['any', 'few'], surface: ['any', 'sidewalk', 'trail'] };
const KEY = { hills: { any: 'planHillsAny', flat: 'planHillsFlat', hilly: 'planHillsHilly' }, crossings: { any: 'planCrossAny', few: 'planCrossFew' }, surface: { any: 'planSurfAny', sidewalk: 'planSurfSidewalk', trail: 'planSurfTrail' } };

/** A small elevation profile (metres over the route) as an SVG polyline. */
export function profileSvg(elev, w = 280, hgt = 44) {
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`); svg.setAttribute('class', 'profile'); svg.setAttribute('aria-hidden', 'true');
  const lo = Math.min(...elev), span = Math.max(8, Math.max(...elev) - lo), pts = elev.map((e, i) => `${(i / (elev.length - 1) * w).toFixed(1)},${(hgt - 3 - (e - lo) / span * (hgt - 8)).toFixed(1)}`);
  const area = document.createElementNS(NS, 'path'); area.setAttribute('d', `M0 ${hgt}L${pts.join('L')}L${w} ${hgt}Z`); area.setAttribute('class', 'prof-area'); svg.append(area);
  const line = document.createElementNS(NS, 'polyline'); line.setAttribute('points', pts.join(' ')); line.setAttribute('class', 'prof-line'); svg.append(line); return svg;
}

export function renderRoutePlan() {
  const stored = getJson('planPrefs', {}), prefs = {}; for (const k of Object.keys(PREFS)) prefs[k] = PREFS[k].includes(stored[k]) ? stored[k] : DEFAULT_PREFS[k];
  const places = { start: null, end: null }, from = getJson('planStart', null);
  if (from && Number.isFinite(from.lat) && Number.isFinite(from.lon)) { places.start = { name: t('planMapPoint'), lat: from.lat, lon: from.lon }; setPref('planStart', 'null'); }
  const body = h('div', { class: 'planbody' }); let alive = true;

  function consent() {
    return h('div', { class: 'card consent' }, h('h2', null, t('planConsentTitle')), h('p', null, t('planConsentBody')),
      h('ul', { class: 'plain' }, ['planSvc1', 'planSvc2', 'planSvc3', 'planSvc4'].map((k) => h('li', null, t(k)))),
      h('button', { type: 'button', class: 'btn', id: 'plan-consent', onclick: () => { setPlanNet(true); draw(); } }, t('planConsentBtn')), h('a', { class: 'btn ghost', href: '#/routes' }, t('recoNotNow')));
  }
  /** One address field: type, press search, pick a match. `places[key]` holds the choice. */
  function placeField(key, label) {
    const input = h('input', { id: `rp-${key}`, type: 'text', maxLength: 120, autocomplete: 'off', placeholder: t('planAddrPh'), 'aria-label': label, value: places[key]?.name || '' }), opts = h('div', { class: 'placeopts', role: 'listbox', 'aria-label': label }), msg = h('p', { class: 'note', role: 'status' });
    input.addEventListener('input', () => { places[key] = null; });
    async function find() {
      msg.textContent = t('planSearching'); setChildren(opts);
      try { const r = await geocode(input.value, getLang()); if (!r.length) { msg.textContent = t('planNoPlace'); return; } msg.textContent = ''; setChildren(opts, r.map((p) => h('button', { type: 'button', class: 'item placeopt', role: 'option', onclick: () => { places[key] = p; input.value = p.name; setChildren(opts); msg.textContent = ''; } }, h('span', { class: 'kind' }, icon('pin', 20)), h('span', null, p.name)))); }
      catch { msg.textContent = t('planNetFail'); }
    }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } });
    const here = h('button', { type: 'button', class: 'btn ghost mapbtn', id: `rp-${key}-here`, onclick: async () => { msg.textContent = t('recoLocating'); try { const p = await locate(); places[key] = { name: t('planMyPlace'), lat: p.lat, lon: p.lon }; input.value = t('planMyPlace'); msg.textContent = ''; } catch { msg.textContent = t('recoLocFail'); } } }, icon('gps', 20), h('span', null, t('planMyPlace')));
    return { el: h('div', { class: 'field' }, h('label', { for: `rp-${key}` }, label), h('div', { class: 'addr' }, input, h('button', { type: 'button', class: 'btn ghost', id: `rp-${key}-find`, 'aria-label': t('search'), onclick: find }, icon('search', 22))), here, opts, msg), input, msg };
  }
  const startF = placeField('start', t('planStart')), endF = placeField('end', t('planEnd'));
  const km = h('input', { id: 'rp-km', type: 'number', inputmode: 'decimal', min: MIN_TARGET_M / 1000, max: MAX_TARGET_M / 1000, step: '0.5', value: String(getNum('planKm', 5, MIN_TARGET_M / 1000, MAX_TARGET_M / 1000)) });
  const same = h('input', { id: 'rp-same', type: 'checkbox', checked: true }), endBox = h('div', { hidden: true }, endF.el);
  same.addEventListener('change', () => { endBox.hidden = same.checked; });
  const sel = (k) => h('div', { class: 'field' }, h('label', { for: `rp-${k}` }, t(`planPref_${k}`)), h('select', { id: `rp-${k}`, onchange: (e) => { prefs[k] = e.target.value; setJson('planPrefs', prefs); } }, PREFS[k].map((v) => h('option', { value: v, selected: prefs[k] === v }, t(KEY[k][v])))));
  const kindSel = h('select', { id: 'rp-kind', 'aria-label': t('planKind') }, ['walk', 'run'].map((k) => h('option', { value: k }, t(k))));
  const prog = h('p', { class: 'note', role: 'status', id: 'rp-status' }), results = h('div', { class: 'rplist', id: 'rp-results' }), go = h('button', { type: 'button', class: 'btn', id: 'rp-go' }, icon('route', 22), t('planGo'));
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t('planKm') }, [3, 5, 8, 10, 15].map((v) => h('button', { type: 'button', class: 'chip', onclick: () => { km.value = String(v); } }, `${v} ${t('km')}`)));

  async function resolve(key, f) { // an address typed but never picked: take the best match, and say which
    if (places[key]) return places[key]; const q = f.input.value.trim(); if (q.length < 2) return null;
    const r = await geocode(q, getLang()); if (!r.length) return null; places[key] = r[0]; f.input.value = r[0].name; return r[0];
  }
  go.addEventListener('click', async () => {
    go.disabled = true; setChildren(results); prog.textContent = t('planSearching');
    try {
      const s = await resolve('start', startF); if (!s) { prog.textContent = t('planNeedStart'); return; }
      let e = null; if (!same.checked) { e = await resolve('end', endF); if (!e) { prog.textContent = t('planNeedEnd'); return; } }
      const targetM = Math.round(Math.min(MAX_TARGET_M, Math.max(MIN_TARGET_M, (Number(km.value) || 5) * 1000))); setPref('planKm', targetM / 1000); km.value = String(targetM / 1000); // what was really asked for is shown
      const res = await planRoutes({ start: [s.lat, s.lon], end: e ? [e.lat, e.lon] : null, targetM, prefs }, api, (phase, n, total) => { prog.textContent = t(phase === 'routes' ? 'planProgRoutes' : 'planProgDetails', { n, total }); });
      if (!alive) return; // left the screen meanwhile
      if (!res.routes.length) { prog.textContent = t('planNone'); return; }
      prog.textContent = t('planFound', { n: res.routes.length }); show(res, targetM);
    } catch { prog.textContent = t('planNetFail'); } finally { go.disabled = false; }
  });

  async function keep(r, name) {
    if ((await listRoutes()).length >= MAX_ROUTES) return null;
    return saveRoute(makeRoute(r.path, { id: newRouteId(), name, oneTime: false }));
  }
  function card(r, i, targetM) {
    const msg = h('p', { class: 'note', role: 'status' }), name = `${t('planRouteName')} ${fmtKm(r.distanceM)}`;
    const stat = (ic, label) => h('span', { class: 'rpstat' }, icon(ic, 18), label);
    return h('article', { class: 'card rpcard', 'data-rank': String(i + 1), 'data-score': String(r.score) },
      h('div', { class: 'rphead' }, h('b', { class: 'rpscore' }, t('planMatch', { pct: r.score })), h('span', { class: 'rpkm' }, fmtKm(r.distanceM)), i === 0 ? h('span', { class: 'badge' }, t('planBest')) : null),
      h('div', { class: 'rpbar', role: 'img', 'aria-label': t('planMatch', { pct: r.score }) }, h('i', { style: { 'inline-size': `${r.score}%` } })),
      trackPicture(r.path, 300, 160),
      r.elev ? profileSvg(r.elev) : null,
      h('div', { class: 'rpstats' }, r.ascentM != null ? stat('up', `${r.ascentM} m`) : null, r.descentM != null ? stat('down', `${r.descentM} m`) : null,
        r.crossings != null ? stat('flag', t('planCrossN', { n: r.crossings })) : null, r.surface ? stat('walk', t('planSidewalkN', { pct: r.surface.sidewalkPct + r.surface.pathPct })) : null, r.surface && r.surface.trailPct ? stat('route', t('planTrailN', { pct: r.surface.trailPct })) : null),
      h('ul', { class: 'plain rpwhy' }, r.why.map(([k, p]) => h('li', null, t(k === 'planWhyDist' ? (p.pct < 2 ? 'planWhyExact' : p.dir ? 'planWhyLonger' : 'planWhyShorter') : k, p)))),
      h('div', { class: 'maptools' },
        h('button', { type: 'button', class: 'btn rp-start', onclick: async () => { const rt = await keep(r, name); if (!rt) { msg.textContent = t('planFull'); return; } location.hash = `#/workout/${kindSel.value}/go/r/${rt.id}`; } }, icon('play', 22), t('planFollow')),
        h('button', { type: 'button', class: 'btn ghost rp-save', onclick: async (e) => { const rt = await keep(r, name); msg.textContent = rt ? t('planSaved') : t('planFull'); if (rt) e.target.disabled = true; } }, icon('route', 20), t('planSave'))), msg);
  }
  function show(res, targetM) {
    const n = res.notes;
    setChildren(results, h('label', { class: 'fsel' }, h('span', { class: 'cap' }, t('planKind')), kindSel), res.routes.map((r, i) => card(r, i, targetM)),
      !n.elevation ? h('p', { class: 'note' }, t('planNoElev')) : null, !n.streets ? h('p', { class: 'note' }, t('planNoStreets')) : null, h('p', { class: 'note' }, t('planAttr')));
    results.scrollIntoView?.({ block: 'start' });
  }

  function draw() {
    if (!planNetOn()) { setChildren(body, consent()); return; }
    setChildren(body, startF.el, h('div', { class: 'field' }, h('label', { for: 'rp-km' }, t('planKm')), km, chips),
      h('label', { class: 'check' }, same, h('span', null, t('planSameEnd'))), endBox, h('details', { class: 'fold' }, h('summary', null, t('planPrefs')), sel('hills'), sel('crossings'), sel('surface')),
      go, prog, results,
      h('p', { class: 'note' }, h('button', { type: 'button', class: 'linkbtn', id: 'plan-revoke', onclick: () => { setPlanNet(false); draw(); } }, t('planRevoke'))));
  }
  const el = h('section', { class: 'routeplan' }, h('h1', null, t('planRouteTitle')), h('p', { class: 'note' }, t('planIntro')), body); draw(); el.cleanup = () => { alive = false; }; return el;
}
