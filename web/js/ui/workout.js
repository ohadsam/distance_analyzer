// Workout mode: one calm screen with big numbers and few buttons. Tracking (GPS) -> workout.js (pure); persistence -> store.js.
import { workoutShareBox } from './workoutShare.js';
import { metricValue, metricPair, METRICS, DEFAULT_METRICS } from '../metrics.js';
import { brokenRecords } from '../records.js';
import { celebrationCard } from './podium.js';
import { trackPicture } from './maptiles.js';
import { speak } from '../voice.js';
import { badgeFor } from '../art.js';
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { stoppedFor, newWorkout, addFix, pause, resume, finish, elapsedMs, avgPaceSec, recentPaceSec, kcal, isPaused } from '../workout.js';
import { fmtClock, fmtKm, fmtPace, fmtPaceUnit } from '../format.js';
import { active, saveWorkout, getNum, getPref, setPref, getJson, listWorkouts, listRoutes, getWorkout, updateWorkout, profile } from '../store.js';
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
import { references, indicators } from '../indicators.js';
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
  const vDist = val('v-dist'), vA = val('v-a'), vB = val('v-b');
  const metric = (label, v, cls = '') => h('div', { class: `metric ${cls}` }, h('div', { class: 'cap' }, label), v);
  // the two numbers next to the distance are the person's choice (Settings); one tap on a card shows the next number
  const pair = () => metricPair(getPref('wkA', DEFAULT_METRICS[0]), getPref('wkB', DEFAULT_METRICS[1]));
  const cycle = (slot) => { const [a, b] = pair(), cur = slot === 0 ? a : b, other = slot === 0 ? b : a; let k = (METRICS.indexOf(cur) + 1) % METRICS.length; if (METRICS[k] === other) k = (k + 1) % METRICS.length; setPref(slot === 0 ? 'wkA' : 'wkB', METRICS[k]); paint(); };
  const capA = h('div', { class: 'cap' }), capB = h('div', { class: 'cap' });
  const cardA = h('button', { type: 'button', class: 'metric tap', id: 'wk-a', onclick: () => cycle(0) }, capA, vA), cardB = h('button', { type: 'button', class: 'metric tap', id: 'wk-b', onclick: () => cycle(1) }, capB, vB);
  const voiceBtn = h('button', { type: 'button', class: 'tool', id: 'wk-voice', 'aria-pressed': String(getPref('voice', '0') === '1'), onclick: () => { const on = getPref('voice', '0') !== '1'; setPref('voice', on ? '1' : '0'); voiceBtn.setAttribute('aria-pressed', String(on)); if (on) say(t('wkVoiceOn')); syncVoice(); } }, icon('volume', 22), t('wkVoice'));
  const gpsCard = h('div', { class: 'gps-card', role: 'status' });
  const sunBtn = h('button', { type: 'button', class: 'tool', id: 'wk-sun', 'aria-pressed': String(getPref('sun', '0') === '1'), onclick: () => { const on = getPref('sun', '0') !== '1'; setPref('sun', on ? '1' : '0'); sunBtn.setAttribute('aria-pressed', String(on)); applySun(); } }, icon('sun', 22), t('wkSun'));
  const applySun = () => { if (getPref('sun', '0') === '1') document.body.dataset.sun = '1'; else delete document.body.dataset.sun; };
  // "It looks like you stopped": offered after ~30 s without moving (never paused automatically), then quiet for 3 minutes
  let stopCool = 0;
  const stopEl = h('div', { class: 'stophint', role: 'status', hidden: true }, h('span', null, t('stopHint')),
    h('button', { type: 'button', class: 'btn', onclick: () => { stopEl.hidden = true; if (phase === 'running') onMain(); } }, t('stopPause')),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => { stopEl.hidden = true; stopCool = Date.now() + 180000; } }, t('stopKeep')));
  const checkStopped = () => { const stopped = phase === 'running' && w && getPref('stopHint', '1') !== '0' && Date.now() > stopCool && stoppedFor(w, Date.now()); if (stopped && stopEl.hidden) { stopEl.hidden = false; sr.textContent = t('stopHint'); } else if (!stopped && !stopEl.hidden) stopEl.hidden = true; };
  const gpsChip = h('div', { class: 'chip', 'data-gps': 'searching', role: 'status' });
  const lockBtn = h('button', { type: 'button', class: 'round', 'aria-label': t('lock'), onclick: () => setLocked(true) }, icon('lock'));
  const mainBtn = h('button', { type: 'button', class: 'big-btn', onclick: () => onMain() });
  const finishBtn = h('button', { type: 'button', class: 'btn ghost', onclick: askFinish }, icon('flag'), t('finish'));
  const metroBtn = h('button', { type: 'button', class: 'tool', id: 'wk-metro', 'aria-pressed': 'false', onclick: () => rhythm.toggle() }, icon('pace', 22), t('wkMetro'));
  const confirmBar = h('div', { class: 'confirm', role: 'group', 'aria-label': t('finishAsk') },
    h('p', null, t('finishAsk')),
    h('button', { type: 'button', class: 'btn', onclick: () => end(true) }, t('saveFinish')),
    h('button', { type: 'button', class: 'btn ghost', onclick: keepGoing }, t('keepGoing')),
    h('button', { type: 'button', class: 'btn danger', onclick: () => end(false) }, t('discard')));
  const lockLayer = h('div', { class: 'lock', hidden: true }, h('div', { class: 'lock-msg' }, icon('lock', 40), h('p', null, t('locked'))));
  const holdBtn = h('button', { type: 'button', class: 'btn' }, t('unlock')); lockLayer.append(holdBtn);
  const body = h('div', { class: 'wk' }), cdEl = h('div', { class: 'countdown', hidden: true, role: 'status', onclick: () => { clearTimeout(cdTimer); cdEl.hidden = true; } });
  // Live map (no tiles) and, when following a saved route, the route line, its name and a "ghost" of the best earlier attempt.
  const lm = liveMap(), ghostEl = h('p', { class: 'ghost', hidden: true }), followEl = h('p', { class: 'note', hidden: true }), mapBox = h('div', { class: 'mapbox' }, stopEl, lm.el, followEl, ghostEl);
  let follow = null, ghost = null, ghostSide = ''; // follow = { route, best }; ghost = (moving ms) -> metres of the best attempt
  if (routeId) (async () => {
    const route = (await listRoutes()).find((r) => r.id === routeId); if (!route) return;
    const bestLight = attemptsOf(route, await listWorkouts({ points: false }), kind).sort((a, b) => paceSec(a) - paceSec(b))[0], best = bestLight ? await getWorkout(bestLight.startedAt) : null; // only the best attempt's points are read
    follow = { route, best: best && best.points.length > 5 ? best : null }; ghost = follow.best ? makeGhost(follow.best.points, follow.best.distanceM) : null; followEl.hidden = false; followEl.textContent = t('followingRoute', { name: route.name }); paintMap();
  })();
  // Live indications and the "last time" ghost: compared with the person's own earlier workouts of this kind (cues can be switched off in Settings).
  const cuesOn = () => getPref('cues', '1') !== '0', cueEl = h('p', { class: 'cue', role: 'status', hidden: true }); mapBox.prepend(cueEl);
  let refs = null, fired = new Set(), ghostIsLast = false, cueTimer = 0;
  (async () => {
    refs = references(await listWorkouts({ points: false }), kind);
    if (w) indicators({ distM: w.distanceM, splits: w.splits }, refs, fired); // a resumed workout: what is already behind us is not news
    if (!routeId && refs.last && cuesOn()) { const full = await getWorkout(refs.last.startedAt); if (full && full.points.length > 5) { ghost = makeGhost(full.points, full.distanceM); ghostIsLast = true; } }
  })();
  const say = (text) => { if (getPref('voice', '0') === '1') speak(text, getLang()); }; // spoken only when the person turned it on
  const cueQueue = [];
  function pumpCues() { // one calm message at a time (about 6 s each); the others wait their turn
    if (!cueQueue.length || !cueEl.hidden) return;
    const { text, key } = cueQueue.shift(); cueEl.hidden = false; setChildren(cueEl, badgeFor(key), h('span', null, text)); sr.textContent = text; say(text);
    if (getPref('cueVibrate', '1') !== '0') try { navigator.vibrate?.(60); } catch { /* not supported */ }
    clearTimeout(cueTimer); cueTimer = setTimeout(() => { cueEl.hidden = true; pumpCues(); }, 6000);
  }
  function checkIndicators() {
    if (!refs || !cuesOn() || !w) return;
    for (const e of indicators({ distM: w.distanceM, splits: w.splits }, refs, fired)) cueQueue.push({ text: t(e.key, e.params), key: e.key });
    if (cueQueue.length > 4) cueQueue.splice(0, cueQueue.length - 4); // never a backlog of stale news
    pumpCues();
  }
  let mapAt = 0;
  function paintMap() { lm.update(w ? w.points : [], follow ? follow.route.path : []); mapAt = Date.now(); }
  function paintGhost() {
    if (!ghost || !w || phase !== 'running' || (ghostIsLast && !cuesOn())) { ghostEl.hidden = true; return; }
    const d = Math.round(w.distanceM - ghost(elapsedMs(w, Date.now()))), m = Math.abs(d), side = m < 10 ? 'on' : d > 0 ? 'ahead' : 'behind';
    const sfx = ghostIsLast ? 'Last' : ''; ghostEl.hidden = false; ghostEl.textContent = m < 10 ? t(`ghostOn${sfx}`) : t(`${d > 0 ? 'ghostAhead' : 'ghostBehind'}${sfx}`, { m }); ghostEl.dataset.side = side;
    if (side !== ghostSide) { ghostSide = side; sr.textContent = ghostEl.textContent; } // announced when the side changes, not every second
  }

  const el = h('section', { class: 'workout', 'data-phase': phase }, h('div', { class: 'wk-top' }, h('h1', { class: 'sr-only' }, t(kind)), gpsChip, h('span', { class: 'grow' }), lockBtn), body, cdEl, lockLayer);

  // ---------- tracking ----------
  // One door for GPS fixes, from the page's own watch AND from the Android background service (a duplicate fix is rejected by addFix: same or older time).
  function feed(fix, src = 'native') {
    if (!w || phase !== 'running' || (src === 'page' && nativeOn)) return; // one source at a time: while the background service is on, its fixes are the only ones
    const n = w.splits.length;
    if (addFix(w, fix)) {
      const fresh = Date.now() - fix.t < 8000; // a fix recorded while the screen was off is old news: the service already spoke it, and cues about it would mislead
      if (w.splits.length > n) { const s = w.splits[w.splits.length - 1]; sr.textContent = `${t('splitKm', { n: s.km })}: ${fmtClock(s.atMs)}`; if (fresh) say(t('speakSplit', { n: s.km, min: Math.floor(s.atMs / 60000), sec: Math.floor(s.atMs / 1000) % 60 })); }
      if (fresh) checkIndicators(); else if (refs) indicators({ distM: w.distanceM, splits: w.splits }, refs, fired); // stale: mark as seen, show nothing
    }
  }
  let nativeOn = false, trackTries = 0, trackNext = 0;
  const trackOn = () => { // false while the location permission is missing: asked again every 8 s, at most 5 times (the page's own GPS carries the workout meanwhile)
    if (!native.trackAvailable() || nativeOn || trackTries >= 5 || Date.now() < trackNext) return;
    trackTries++; trackNext = Date.now() + 8000; nativeOn = native.trackStart(t('trackTitle'), t('trackText')); if (nativeOn) syncVoice();
  };
  /** Tells the Android service how to speak the kilometre times while the screen is off (it counts from where the page is now). */
  function syncVoice() { if (!native.available) return; native.setVoice({ on: getPref('voice', '0') === '1', lang: getLang(), tpl: t('speakSplit'), dist: w ? Math.round(w.distanceM) : 0, moving: w ? Math.round(w.movingMs) : 0 }); }
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

  // optional 3-2-1 (or 5-4-3-2-1) before the start; a tap on the number cancels it
  let cdTimer = 0;
  function startCountdown(n) {
    cdEl.hidden = false; let left = n;
    const tick = () => { cdEl.textContent = left > 0 ? String(left) : t('wkGo'); sr.textContent = cdEl.textContent; if (getPref('voice', '0') === '1') speak(cdEl.textContent, getLang());
      if (left <= 0) { cdEl.hidden = true; onMain(true); return; } left--; cdTimer = setTimeout(tick, 1000); };
    tick();
  }
  function announceNow() { if (!w) return; const text = t('announceNow', { km: (w.distanceM / 1000).toFixed(2), min: Math.floor(elapsedMs(w, Date.now()) / 60000) }); cueQueue.push({ text, key: '' }); pumpCues(); speak(text, getLang()); }
  function onMain(instant = false) {
    const n = Date.now();
    if (phase === 'ready' && !instant && Number(getPref('countdown', '0')) > 0) return startCountdown(Number(getPref('countdown', '0')));
    if (phase === 'ready') { w = newWorkout(kind, n); fired = new Set(); phase = 'running'; keepAwake(true); rhythm.setRunning(true); trackOn(); }
    else if (phase === 'running') { drainNative(); pause(w, n); phase = 'paused'; rhythm.setRunning(false); trackOff(); persist(); }
    else if (phase === 'paused') { native.trackDrain(); resume(w, n); phase = 'running'; keepAwake(true); rhythm.setRunning(true); trackOn(); }
    paint();
  }
  // Finish asks first. The workout pauses while the question is open (no time, distance or clicking is added meanwhile).
  let before = 'paused';
  function askFinish() { before = phase; if (phase === 'running') { drainNative(); pause(w, Date.now()); rhythm.setRunning(false); trackOff(); } phase = 'confirm'; paint(); }
  function keepGoing() { if (before === 'running') { native.trackDrain(); resume(w, Date.now()); phase = 'running'; rhythm.setRunning(true); trackOn(); } else phase = 'paused'; paint(); }
  let saved = null, routeEl = null, planEl = null, recordEl = null;
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
    try { const rs = brokenRecords(await listWorkouts({ points: false }), saved); if (rs.length) recordEl = celebrationCard(rs, saved); } catch { /* a celebration is a bonus, never a blocker */ }
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
    const label = gps === 'good' ? t('gpsGood') : gps === 'weak' ? t('gpsWeak') : gps === 'denied' ? t('gpsDenied') : gps === 'missing' ? t('gpsMissing') : t('gpsSearching');
    setChildren(gpsChip, icon('gps', 18), label); gpsCard.dataset.gps = gps; setChildren(gpsCard, icon('gps', 40), h('b', null, label));
  };
  function paint() {
    const n = Date.now();
    vDist.textContent = w ? (w.distanceM / 1000).toFixed(2) : '0.00';
    const ctx = { now: n, weightKg: getNum('weight', 70, 30, 250), bpm: Number(rhythm.el.dataset.bpm) || 0 }, [a, b] = pair();
    for (const [id, cap, v] of [[a, capA, vA], [b, capB, vB]]) { const m = metricValue(id, w, ctx); v.textContent = m.text; cap.textContent = m.unit ? `${t(m.cap)} (${t(m.unit)})` : t(m.cap); }
    el.dataset.phase = phase; paintBody();
  }
  let bodyPhase = '';
  function paintBody() { // rebuild the button area only when the phase changes
    if (bodyPhase === phase) return; bodyPhase = phase;
    if (phase === 'done') return setChildren(body, summary());
    const main = phase === 'ready' ? [icon('play', 36), t('start')] : phase === 'running' ? [icon('pause', 36), t('pause')] : [icon('play', 36), t('resume')];
    setChildren(mainBtn, main); mainBtn.classList.toggle('is-pause', phase === 'running');
    const stats = h('div', { class: 'wk-stats' }, h('div', { class: 'metric hero' }, h('div', { class: 'cap' }, `${t('distance')} (${t('km')})`), vDist), h('div', { class: 'wk-two' }, cardA, cardB));
    setChildren(body, phase === 'ready' ? gpsCard : stats, mapBox, rhythm.el,
      phase === 'confirm' ? confirmBar : h('div', { class: 'wk-tools' }, metroBtn, voiceBtn, sunBtn),
      phase === 'confirm' ? null : h('div', { class: 'controls' }, phase === 'ready' ? h('span') : finishBtn, mainBtn));
  }
  function summary() {
    const n = w.endedAt, mins = elapsedMs(w, n);
    const row = (k, v) => h('div', { class: 'row' }, h('span', null, k), h('b', null, v));
    return h('div', { class: 'summary' }, h('h2', null, t('summary')), trackPicture(w.points),
      h('div', { class: 'rows' }, row(t('distance'), fmtKm(w.distanceM)), row(t('time'), fmtClock(mins)), row(t('movingTime'), fmtClock(w.movingMs)), row(t('avgPace'), fmtPaceUnit(avgPaceSec(w))), row(t('kcal'), `${kcal(w, getNum('weight', 70, 30, 250))} ${t('kcalUnit')}`)),
      workoutShareBox(w), recordEl, planEl, routeEl, headsUp ? h('div', null, h('h2', null, t('headsUp')), alertCard(headsUp)) : null,
      h('a', { class: 'btn', href: '#/' }, t('done')));
  }

  // ---------- lifecycle ----------
  // hands-free: a double tap on the numbers or the map pauses / resumes (buttons, inputs and the lock screen are never affected); the volume keys do the same on Android
  const handsFreeOn = () => getPref('handsFree', '1') !== '0';
  body.addEventListener('dblclick', (e) => { if (!handsFreeOn() || e.target.closest('button, a, input, select')) return; if (phase === 'running' || phase === 'paused') onMain(); });
  const onKey = (e) => { const d = e.detail; if (d?.type !== 'key' || !handsFreeOn() || lockLayer.hidden === false) return; if (d.key === 'volume-down' && (phase === 'running' || phase === 'paused')) onMain(); else if (d.key === 'volume-up') announceNow(); };
  addEventListener('stepup-native', onKey); native.handsFree(handsFreeOn());
  applySun(); startGps(); paintGps(); paint();
  let ticks = 0;
  paintMap();
  if (go && phase === 'ready') { history.replaceState(null, '', `#/workout/${kind}${routeId ? `/r/${routeId}` : ''}`); onMain(true); } // "measure now": start at once, and forget the /go address so Back or a reload never starts another one
  tickId = setInterval(() => { drainNative(); ++ticks; if (phase === 'running' && ticks % 30 === 0) persist(); /* the save heartbeat runs even with the screen off */ if (document.hidden) return; /* nobody is looking: no painting */ paint(); paintGhost(); checkStopped(); if (phase === 'running' && Date.now() - mapAt >= 3000) paintMap(); }, 1000);
  const onHide = () => { if (document.hidden) persist(); else if (phase === 'running') { keepAwake(true); drainNative(); } };
  document.addEventListener('visibilitychange', onHide); addEventListener('pagehide', persist);
  el.cleanup = () => { delete document.body.dataset.sun; clearTimeout(cdTimer); removeEventListener('stepup-native', onKey); native.handsFree(false); clearInterval(tickId); clearTimeout(holdT); navigator.geolocation?.clearWatch(watch); document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', persist); persist(); rhythm.destroy(); keepAwake(false); };
  return el;
}
