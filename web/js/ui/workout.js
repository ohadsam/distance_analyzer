// Workout mode: one calm screen with big numbers and few buttons. Tracking (GPS) -> workout.js (pure); persistence -> store.js.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon, trackSvg } from '../icons.js';
import { newWorkout, addFix, pause, resume, finish, elapsedMs, avgPaceSec, recentPaceSec, kcal, isPaused } from '../workout.js';
import { projectTrack } from '../geo.js';
import { fmtClock, fmtKm, fmtPace, fmtPaceUnit } from '../format.js';
import { active, saveWorkout, getNum, getPref, getJson, listWorkouts, listRoutes, getWorkout, updateWorkout, profile } from '../store.js';
import { checkWorkout } from '../effort.js';
import { pushAlert } from './notify.js';
import { alertCard } from './alerts.js';
import { liveMap } from './livemap.js';
import { summaryBox } from './routes.js';
import { matchAfterWorkout, sessionTitle } from './plan.js';
import { attemptsOf } from '../routeReco.js';
import { makeGhost } from '../route.js';
import { onlineOn, cachedForecast } from '../weatherApi.js';
import { weatherAt } from '../forecast.js';
import { paceSec } from '../stats.js';
import { createRhythm } from './rhythm.js';
import { native } from '../native.js';
import { syncNative } from '../syncNative.js';

const HOLD_MS = 900, MIN_SAVE_M = 10; // a workout shorter than this is not worth a history entry

export function renderWorkout(kind, go, routeId) {
  let w = active.load(), watch = 0, wake = null, tickId = 0, gps = 'searching', acc = 0, phase = 'ready'; // ready | running | paused | confirm | done
  if (w && !isPaused(w) && native.trackAvailable()) for (const f of native.trackDrain()) addFix(w, { lat: f[0], lon: f[1], t: f[2], acc: f[3] }); // the background service kept recording while the app was closed
  if (w) { kind = w.kind; if (!isPaused(w)) pause(w, w.last?.t || Date.now()); phase = 'paused'; if (native.trackAvailable()) native.trackStop(); } // a reopened workout waits paused: the background service must not keep running // a reloaded workout waits, so the gap is not counted
  const sr = document.getElementById('sr');

  const rhythm = createRhythm({ onChange: (on) => { metroBtn.setAttribute('aria-pressed', String(on)); metroBtn.classList.toggle('on', on); } });
  const val = (cls) => h('div', { class: `val ${cls}` }, '–');
  const vTime = val('v-time'), vDist = val('v-dist'), vPace = val('v-pace');
  const metric = (label, v, cls = '') => h('div', { class: `metric ${cls}` }, h('div', { class: 'cap' }, label), v);
  const gpsChip = h('div', { class: 'chip', 'data-gps': 'searching', role: 'status' });
  const lockBtn = h('button', { type: 'button', class: 'round', 'aria-label': t('lock'), onclick: () => setLocked(true) }, icon('lock'));
  const mainBtn = h('button', { type: 'button', class: 'big-btn', onclick: onMain });
  const finishBtn = h('button', { type: 'button', class: 'btn ghost', onclick: askFinish }, icon('flag'), t('finish'));
  const metroBtn = h('button', { type: 'button', class: 'round', 'aria-pressed': 'false', 'aria-label': t('metro'), onclick: () => rhythm.toggle() }, icon('pace'));
  const confirmBar = h('div', { class: 'confirm', role: 'group', 'aria-label': t('finishAsk') },
    h('p', null, t('finishAsk')),
    h('button', { type: 'button', class: 'btn', onclick: () => end(true) }, t('saveFinish')),
    h('button', { type: 'button', class: 'btn ghost', onclick: keepGoing }, t('keepGoing')),
    h('button', { type: 'button', class: 'btn danger', onclick: () => end(false) }, t('discard')));
  const lockLayer = h('div', { class: 'lock', hidden: true }, h('div', { class: 'lock-msg' }, icon('lock', 40), h('p', null, t('locked'))));
  const holdBtn = h('button', { type: 'button', class: 'btn' }, t('unlock')); lockLayer.append(holdBtn);
  const body = h('div', { class: 'wk' });
  // Live map (no tiles) and, when following a saved route, the route line, its name and a "ghost" of the best earlier attempt.
  const lm = liveMap(), ghostEl = h('p', { class: 'ghost', hidden: true }), followEl = h('p', { class: 'note', hidden: true }), mapBox = h('div', { class: 'mapbox' }, lm.el, followEl, ghostEl);
  let follow = null, ghost = null, ghostSide = ''; // follow = { route, best }; ghost = (moving ms) -> metres of the best attempt
  if (routeId) (async () => {
    const route = (await listRoutes()).find((r) => r.id === routeId); if (!route) return;
    const bestLight = attemptsOf(route, await listWorkouts({ points: false }), kind).sort((a, b) => paceSec(a) - paceSec(b))[0], best = bestLight ? await getWorkout(bestLight.startedAt) : null; // only the best attempt's points are read
    follow = { route, best: best && best.points.length > 5 ? best : null }; ghost = follow.best ? makeGhost(follow.best.points, follow.best.distanceM) : null; followEl.hidden = false; followEl.textContent = t('followingRoute', { name: route.name }); paintMap();
  })();
  let mapAt = 0;
  function paintMap() { lm.update(w ? w.points : [], follow ? follow.route.path : []); mapAt = Date.now(); }
  function paintGhost() {
    if (!ghost || !w || phase !== 'running') { ghostEl.hidden = true; return; }
    const d = Math.round(w.distanceM - ghost(elapsedMs(w, Date.now()))), m = Math.abs(d), side = m < 10 ? 'on' : d > 0 ? 'ahead' : 'behind';
    ghostEl.hidden = false; ghostEl.textContent = m < 10 ? t('ghostOn') : t(d > 0 ? 'ghostAhead' : 'ghostBehind', { m }); ghostEl.dataset.side = side;
    if (side !== ghostSide) { ghostSide = side; sr.textContent = ghostEl.textContent; } // announced when the side changes, not every second
  }

  const el = h('section', { class: 'workout', 'data-phase': phase }, h('div', { class: 'wk-top' }, h('h1', { class: 'sr-only' }, t(kind)), gpsChip, h('span', { class: 'grow' }), lockBtn), body, lockLayer);

  // ---------- tracking ----------
  // One door for GPS fixes, from the page's own watch AND from the Android background service (a duplicate fix is rejected by addFix: same or older time).
  function feed(fix, src = 'native') {
    if (!w || phase !== 'running' || (src === 'page' && nativeOn)) return; // one source at a time: while the background service is on, its fixes are the only ones
    const n = w.splits.length;
    if (addFix(w, fix) && w.splits.length > n) { const s = w.splits[w.splits.length - 1]; sr.textContent = `${t('splitKm', { n: s.km })}: ${fmtClock(s.atMs)}`; }
  }
  let nativeOn = false, trackTries = 0, trackNext = 0;
  const trackOn = () => { // false while the location permission is missing: asked again every 8 s, at most 5 times (the page's own GPS carries the workout meanwhile)
    if (!native.trackAvailable() || nativeOn || trackTries >= 5 || Date.now() < trackNext) return;
    trackTries++; trackNext = Date.now() + 8000; nativeOn = native.trackStart(t('trackTitle'), t('trackText'));
  };
  const trackOff = () => { if (native.trackAvailable()) native.trackStop(); nativeOn = false; trackTries = 0; trackNext = 0; };
  function drainNative() { if (phase !== 'running' || !native.trackAvailable()) return; trackOn(); for (const f of native.trackDrain()) feed({ lat: f[0], lon: f[1], t: f[2], acc: f[3] }); }
  function startGps() {
    if (!navigator.geolocation) { gps = 'missing'; return; }
    watch = navigator.geolocation.watchPosition((pos) => {
      acc = pos.coords.accuracy; gps = acc <= 35 ? 'good' : 'weak';
      feed({ lat: pos.coords.latitude, lon: pos.coords.longitude, t: pos.timestamp || Date.now(), acc }, 'page');
      paintGps();
    }, (e) => { gps = e.code === 1 ? 'denied' : 'weak'; paintGps(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  }
  const keepAwake = async (on) => { native.keepAwake(on); try { if (on) wake = await navigator.wakeLock?.request('screen'); else { await wake?.release(); wake = null; } } catch { /* not supported: the screen may sleep */ } };
  const persist = () => { if (w && phase !== 'ready' && phase !== 'done') active.save(w); };

  function onMain() {
    const n = Date.now();
    if (phase === 'ready') { w = newWorkout(kind, n); phase = 'running'; keepAwake(true); rhythm.setRunning(true); trackOn(); }
    else if (phase === 'running') { drainNative(); pause(w, n); phase = 'paused'; rhythm.setRunning(false); trackOff(); persist(); }
    else if (phase === 'paused') { native.trackDrain(); resume(w, n); phase = 'running'; keepAwake(true); rhythm.setRunning(true); trackOn(); }
    paint();
  }
  // Finish asks first. The workout pauses while the question is open (no time, distance or clicking is added meanwhile).
  let before = 'paused';
  function askFinish() { before = phase; if (phase === 'running') { drainNative(); pause(w, Date.now()); rhythm.setRunning(false); trackOff(); } phase = 'confirm'; paint(); }
  function keepGoing() { if (before === 'running') { native.trackDrain(); resume(w, Date.now()); phase = 'running'; rhythm.setRunning(true); trackOn(); } else phase = 'paused'; paint(); }
  let saved = null, routeEl = null, planEl = null;
  async function end(save) {
    const keep = save && w && w.distanceM >= MIN_SAVE_M;
    if (w) { finish(w, Date.now()); if (keep) saved = await saveWorkout(w); }
    active.clear(); rhythm.destroy(); keepAwake(false); trackOff();
    if (keep) { await effortCheck(); await afterSave(); syncNative(); phase = 'done'; paint(); } else { if (save) sr.textContent = t('tooShort'); w = null; location.hash = '#/'; }
  }

  // After saving: the weather during the workout (from the saved forecast, when the person uses the online forecast) and the route box (recognise / save / follow).
  async function afterSave() {
    if (!saved) return;
    try { const f = onlineOn() ? cachedForecast(Date.now(), 12 * 3600000) : null, wx = f && weatherAt(f, saved.startedAt); if (wx && !saved.weather) saved = (await updateWorkout(saved.startedAt, { weather: wx })) || saved; } catch { /* the weather is a bonus */ }
    routeEl = summaryBox(saved, routeId || '');
    const ps = matchAfterWorkout(saved); if (ps) planEl = h('p', { class: 'good', 'data-plan-done': ps.id }, `${t('planSessionDone')}: ${sessionTitle(ps)}`);
  }

  // After saving: is this workout far beyond the plan? Then explain what happened, why it matters and how to raise the bar gently.
  let headsUp = null;
  async function effortCheck() {
    if (getPref('effortAlerts', '1') !== '1') return;
    try {
      const rows = await listWorkouts(), rec = rows.find((r) => r.startedAt === w.startedAt); if (!rec) return;
      const c = checkWorkout(rec, rows.filter((r) => r.startedAt !== rec.startedAt), profile().age, w.endedAt, getJson('barOv', null));
      if (c) headsUp = pushAlert({ id: `eff-${rec.startedAt}`, kind: 'effort', level: c.level, title: `eff_${c.id}_title`, lines: [`eff_${c.id}_what`, `eff_${c.id}_risk`, `eff_${c.id}_tip`], params: { ...c.params, plan: c.plan, ...(c.newTarget ? { newTarget: c.newTarget } : {}) }, href: '#/alerts' });
    } catch { /* the workout is saved either way */ }
  }

  // ---------- lock: press and hold to unlock, so a sweaty hand or a pocket cannot stop the workout ----------
  let holdT = 0;
  const setLocked = (on) => { lockLayer.hidden = !on; el.classList.toggle('is-locked', on); if (on) holdBtn.focus(); else mainBtn.focus(); };
  const hold = () => { clearTimeout(holdT); holdT = setTimeout(() => setLocked(false), HOLD_MS); holdBtn.classList.add('holding'); };
  const release = () => { clearTimeout(holdT); holdBtn.classList.remove('holding'); };
  holdBtn.addEventListener('pointerdown', hold); for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) holdBtn.addEventListener(ev, release);
  holdBtn.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); hold(); } }); holdBtn.addEventListener('keyup', release);

  // ---------- painting (only text and attributes change per tick; the screen is never rebuilt while running) ----------
  const paintGps = () => {
    gpsChip.dataset.gps = gps;
    setChildren(gpsChip, icon('gps', 18), gps === 'good' ? t('gpsGood') : gps === 'weak' ? t('gpsWeak') : gps === 'denied' ? t('gpsDenied') : gps === 'missing' ? t('gpsMissing') : t('gpsSearching'));
  };
  function paint() {
    const n = Date.now();
    vTime.textContent = fmtClock(w ? elapsedMs(w, n) : 0);
    vDist.textContent = w ? (w.distanceM / 1000).toFixed(2) : '0.00';
    vPace.textContent = fmtPace(w ? recentPaceSec(w) : 0);
    el.dataset.phase = phase; paintBody();
  }
  let bodyPhase = '';
  function paintBody() { // rebuild the button area only when the phase changes
    if (bodyPhase === phase) return; bodyPhase = phase;
    if (phase === 'done') return setChildren(body, summary());
    const main = phase === 'ready' ? [icon('play', 36), t('start')] : phase === 'running' ? [icon('pause', 36), t('pause')] : [icon('play', 36), t('resume')];
    setChildren(mainBtn, main); mainBtn.classList.toggle('is-pause', phase === 'running');
    setChildren(body,
      h('div', { class: 'metrics' }, metric(t('time'), vTime, 'wide'), metric(t('distance') + ` (${t('km')})`, vDist, 'wide'), metric(`${t('pace')} (${t('perKm')})`, vPace)),
      mapBox, rhythm.el,
      phase === 'confirm' ? confirmBar : h('div', { class: 'controls' }, phase === 'ready' ? h('span') : finishBtn, mainBtn, metroBtn));
  }
  function summary() {
    const n = w.endedAt, mins = elapsedMs(w, n), xy = projectTrack(w.points, 300, 180);
    const row = (k, v) => h('div', { class: 'row' }, h('span', null, k), h('b', null, v));
    return h('div', { class: 'summary' }, h('h2', null, t('summary')), trackSvg(xy),
      h('div', { class: 'rows' }, row(t('distance'), fmtKm(w.distanceM)), row(t('time'), fmtClock(mins)), row(t('movingTime'), fmtClock(w.movingMs)), row(t('avgPace'), fmtPaceUnit(avgPaceSec(w))), row(t('kcal'), `${kcal(w, getNum('weight', 70, 30, 250))} ${t('kcalUnit')}`)),
      planEl, routeEl, headsUp ? h('div', null, h('h2', null, t('headsUp')), alertCard(headsUp)) : null,
      h('a', { class: 'btn', href: '#/' }, t('done')));
  }

  // ---------- lifecycle ----------
  startGps(); paintGps(); paint();
  let ticks = 0;
  paintMap();
  if (go && phase === 'ready') { history.replaceState(null, '', `#/workout/${kind}${routeId ? `/r/${routeId}` : ''}`); onMain(); } // "measure now": start at once, and forget the /go address so Back or a reload never starts another one
  tickId = setInterval(() => { drainNative(); paint(); paintGhost(); if (phase === 'running' && Date.now() - mapAt >= 3000) paintMap(); if (phase === 'running' && ++ticks % 30 === 0) persist(); }, 1000);
  const onHide = () => { if (document.hidden) persist(); else if (phase === 'running') { keepAwake(true); drainNative(); } };
  document.addEventListener('visibilitychange', onHide); addEventListener('pagehide', persist);
  el.cleanup = () => { clearInterval(tickId); clearTimeout(holdT); navigator.geolocation?.clearWatch(watch); document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', persist); persist(); rhythm.destroy(); keepAwake(false); };
  return el;
}
