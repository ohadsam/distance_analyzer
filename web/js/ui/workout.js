// Workout mode: one calm screen with big numbers and few buttons. Tracking (GPS) -> workout.js (pure); persistence -> store.js.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icon, trackSvg } from '../icons.js';
import { newWorkout, addFix, pause, resume, finish, elapsedMs, avgPaceSec, recentPaceSec, kcal, isPaused } from '../workout.js';
import { projectTrack } from '../geo.js';
import { fmtClock, fmtKm, fmtPace, fmtPaceUnit } from '../format.js';
import { active, saveWorkout, getNum, getPref, getJson, listWorkouts, profile } from '../store.js';
import { checkWorkout } from '../effort.js';
import { pushAlert } from './notify.js';
import { alertCard } from './alerts.js';
import { createRhythm } from './rhythm.js';
import { native } from '../native.js';

const HOLD_MS = 900, MIN_SAVE_M = 10; // a workout shorter than this is not worth a history entry

export function renderWorkout(kind) {
  let w = active.load(), watch = 0, wake = null, tickId = 0, gps = 'searching', acc = 0, phase = 'ready'; // ready | running | paused | confirm | done
  if (w) { kind = w.kind; if (!isPaused(w)) pause(w, w.last?.t || Date.now()); phase = 'paused'; } // a reloaded workout waits, so the gap is not counted
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
  const el = h('section', { class: 'workout', 'data-phase': phase }, h('div', { class: 'wk-top' }, h('h1', { class: 'sr-only' }, t(kind)), gpsChip, h('span', { class: 'grow' }), lockBtn), body, lockLayer);

  // ---------- tracking ----------
  function startGps() {
    if (!navigator.geolocation) { gps = 'missing'; return; }
    watch = navigator.geolocation.watchPosition((pos) => {
      acc = pos.coords.accuracy; gps = acc <= 35 ? 'good' : 'weak';
      if (w && phase === 'running') {
        const n = w.splits.length;
        if (addFix(w, { lat: pos.coords.latitude, lon: pos.coords.longitude, t: pos.timestamp || Date.now(), acc }) && w.splits.length > n) { const s = w.splits[w.splits.length - 1]; sr.textContent = `${t('splitKm', { n: s.km })}: ${fmtClock(s.atMs)}`; }
      }
      paintGps();
    }, (e) => { gps = e.code === 1 ? 'denied' : 'weak'; paintGps(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  }
  const keepAwake = async (on) => { native.keepAwake(on); try { if (on) wake = await navigator.wakeLock?.request('screen'); else { await wake?.release(); wake = null; } } catch { /* not supported: the screen may sleep */ } };
  const persist = () => { if (w && phase !== 'ready' && phase !== 'done') active.save(w); };

  function onMain() {
    const n = Date.now();
    if (phase === 'ready') { w = newWorkout(kind, n); phase = 'running'; keepAwake(true); rhythm.setRunning(true); }
    else if (phase === 'running') { pause(w, n); phase = 'paused'; rhythm.setRunning(false); persist(); }
    else if (phase === 'paused') { resume(w, n); phase = 'running'; keepAwake(true); rhythm.setRunning(true); }
    paint();
  }
  // Finish asks first. The workout pauses while the question is open (no time, distance or clicking is added meanwhile).
  let before = 'paused';
  function askFinish() { before = phase; if (phase === 'running') { pause(w, Date.now()); rhythm.setRunning(false); } phase = 'confirm'; paint(); }
  function keepGoing() { if (before === 'running') { resume(w, Date.now()); phase = 'running'; rhythm.setRunning(true); } else phase = 'paused'; paint(); }
  async function end(save) {
    const keep = save && w && w.distanceM >= MIN_SAVE_M;
    if (w) { finish(w, Date.now()); if (keep) await saveWorkout(w); }
    active.clear(); rhythm.destroy(); keepAwake(false);
    if (keep) { await effortCheck(); phase = 'done'; paint(); } else { if (save) sr.textContent = t('tooShort'); w = null; location.hash = '#/'; }
  }

  // After saving: is this workout far beyond the plan? Then explain what happened, why it matters and how to raise the bar gently.
  let headsUp = null;
  async function effortCheck() {
    if (getPref('effortAlerts', '1') !== '1') return;
    try {
      const rows = await listWorkouts(), rec = rows.find((r) => r.startedAt === w.startedAt); if (!rec) return;
      const c = checkWorkout(rec, rows.filter((r) => r.startedAt !== rec.startedAt), profile().age, w.endedAt);
      if (c) headsUp = pushAlert({ id: `eff-${rec.startedAt}`, kind: 'effort', level: c.level, title: `eff_${c.id}_title`, lines: [`eff_${c.id}_what`, `eff_${c.id}_risk`, `eff_${c.id}_tip`], params: { ...c.params, plan: c.plan, newTarget: c.newTarget }, href: '#/alerts' });
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
      rhythm.el,
      phase === 'confirm' ? confirmBar : h('div', { class: 'controls' }, phase === 'ready' ? h('span') : finishBtn, mainBtn, metroBtn));
  }
  function summary() {
    const n = w.endedAt, mins = elapsedMs(w, n), xy = projectTrack(w.points, 300, 180);
    const row = (k, v) => h('div', { class: 'row' }, h('span', null, k), h('b', null, v));
    return h('div', { class: 'summary' }, h('h2', null, t('summary')), trackSvg(xy),
      h('div', { class: 'rows' }, row(t('distance'), fmtKm(w.distanceM)), row(t('time'), fmtClock(mins)), row(t('movingTime'), fmtClock(w.movingMs)), row(t('avgPace'), fmtPaceUnit(avgPaceSec(w))), row(t('kcal'), `${kcal(w, getNum('weight', 70, 30, 250))} ${t('kcalUnit')}`)),
      headsUp ? h('div', null, h('h2', null, t('headsUp')), alertCard(headsUp)) : null,
      h('a', { class: 'btn', href: '#/' }, t('done')));
  }

  // ---------- lifecycle ----------
  startGps(); paintGps(); paint();
  let ticks = 0;
  tickId = setInterval(() => { paint(); if (phase === 'running' && ++ticks % 30 === 0) persist(); }, 1000);
  const onHide = () => { if (document.hidden) persist(); else if (phase === 'running') keepAwake(true); };
  document.addEventListener('visibilitychange', onHide); addEventListener('pagehide', persist);
  el.cleanup = () => { clearInterval(tickId); clearTimeout(holdT); navigator.geolocation?.clearWatch(watch); document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', persist); persist(); rhythm.destroy(); keepAwake(false); };
  return el;
}
