// The smart rhythm coach (metronome) panel: listens to the runner's steps with the motion sensor, stays silent while it learns,
// then clicks at the runner's own steady cadence and animates a calm pulse + breathing guide. Logic lives in cadence.js / metronome.js.
import { h } from '../util.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { createCadence, createStepDetector, rhythmHint, CAD } from '../cadence.js';
import { createMetronome } from '../audio.js';
import { breathAt, lungAt } from '../metronome.js';
import { getNum, getPref } from '../store.js';

const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const now = () => performance.now();

/** Returns { el, toggle(), setRunning(bool), isOn(), destroy() }. `onChange(on)` lets the caller reflect the on/off state on its button. */
/** How many beats share one visual pulse so it stays at or below 75 a minute (the design kit's flash-safety rule). */
export const visualDivisor = (bpm) => Math.max(1, Math.ceil(bpm / 75));
export function createRhythm({ onChange = () => {} } = {}) {
  const cad = createCadence(0), det = createStepDetector(), metro = createMetronome();
  let on = false, running = false, raf = 0, tick = 0, sensorTimer = 0, gotMotion = false, lastBpm = 0, lastLabel = '', pattern = '3:2', noSensor = false;

  // design kit: a breathing disc (halo + disc + hollow core) with a beat dot in the middle; while the app is still learning the cadence it shows four calm bars instead
  const art = h('div', { class: 'rhythm-art', 'aria-hidden': 'true' }, h('span', { class: 'rhythm-lung' }, h('i'), h('i'), h('i')), h('span', { class: 'rhythm-beat' }), h('span', { class: 'rhythm-learn' }, h('i'), h('i'), h('i'), h('i')));
  const big = h('div', { class: 'rhythm-bpm' }), label = h('div', { class: 'rhythm-label' }), cue = h('div', { class: 'rhythm-cue', 'aria-hidden': 'true' });
  const less = h('button', { type: 'button', class: 'round', 'aria-label': t('metroLess'), onclick: () => nudge(-2) }, icon('down')), more = h('button', { type: 'button', class: 'round', 'aria-label': t('metroMore'), onclick: () => nudge(2) }, icon('up'));
  const adjust = h('div', { class: 'rhythm-adjust' }, less, more);
  const el = h('section', { class: 'rhythm', hidden: true, 'data-state': 'off', 'aria-label': t('metro') }, art, big, label, cue, adjust);

  const state = () => cad.snapshot;
  function nudge(d) { const s = state(); if (s.state !== 'locked') return; cad.setManual(s.bpm + d); sync(); }

  function onMotion(e) {
    const a = e.accelerationIncludingGravity; if (!a) return;
    gotMotion = true; if (!running) return; const t0 = now(), s = det(t0, a.x ?? 0, a.y ?? 0, a.z ?? 0); if (s) cad.step(s);
  }
  function render() {
    const s = state(), hint = rhythmHint(s.bpm, s.measured);
    el.dataset.state = !on ? 'off' : s.state === 'locked' ? 'locked' : 'listening'; el.dataset.bpm = String(s.bpm || 0); el.dataset.hint = hint;
    big.textContent = s.state === 'locked' ? String(s.bpm) : '';
    label.textContent = noSensor ? t('metroNoSensor') : s.state === 'locked' ? (hint === 'fast' ? t('metroFaster') : hint === 'slow' ? t('metroSlower') : hint === 'on' ? t('metroSteady') : t('steps')) : t('metroListen');
    adjust.hidden = s.state !== 'locked';
  }
  function sync() {
    const s = state();
    if (on && running && s.state === 'locked') {
      if (!metro.running) metro.start(s.bpm, { vol: getNum('volume', 60, 0, 100) / 100, accentOf: (i) => pattern !== 'off' && breathAt(i, pattern).first });
      else if (s.bpm !== lastBpm) metro.setBpm(s.bpm);
      lastBpm = s.bpm; if (!raf && !reduced()) raf = requestAnimationFrame(frame);
    } else if (metro.running) { metro.stop(); lastBpm = 0; }
    render();
  }
  function frame() {
    raf = 0; if (!metro.running) return;
    const p = metro.pos(), i = Math.floor(p), b = breathAt(i, pattern), q = p / visualDivisor(lastBpm), beat = Math.exp(-(q - Math.floor(q)) * 6); // the picture never pulses faster than 75 times a minute (flash-safe); the clicks keep the real cadence
    el.style.setProperty('--beat', beat.toFixed(3)); el.style.setProperty('--lung', lungAt(p, pattern).toFixed(3));
    const txt = b.phase === 'in' ? t('breatheIn') : b.phase === 'out' ? t('breatheOut') : '';
    if (txt !== lastLabel) { lastLabel = txt; cue.textContent = txt; }
    raf = requestAnimationFrame(frame);
  }
  function second() {
    cad.tick(now()); sync();
    if (reduced() && metro.running) { const b = breathAt(Math.floor(metro.pos()), pattern); cue.textContent = b.phase === 'in' ? t('breatheIn') : b.phase === 'out' ? t('breatheOut') : ''; }
  }

  async function enable() {
    metro.unlock(); on = true; pattern = getPref('breath', '3:2'); gotMotion = false; noSensor = false; lastBpm = 0; lastLabel = ''; el.hidden = false;
    cad.start(now()); tick = setInterval(second, 1000); sync(); onChange(true); // shows "listening" at once; the sensor may first ask for permission (iOS)
    try { if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') await DeviceMotionEvent.requestPermission(); } catch { /* iOS asks first; if refused no events arrive and the manual rhythm takes over */ }
    if (!on) return; // switched off while the permission question was open
    addEventListener('devicemotion', onMotion); // listening costs nothing: a refusal simply yields no events
    sensorTimer = setTimeout(() => { if (on && !gotMotion) { noSensor = true; cad.setManual(getNum('bpm', 170, CAD.minBpm, CAD.maxBpm)); sync(); } }, 4000);
  }
  function disable() {
    on = false; metro.stop(); cancelAnimationFrame(raf); raf = 0; clearInterval(tick); clearTimeout(sensorTimer); removeEventListener('devicemotion', onMotion); cad.stop(); el.hidden = true; render(); onChange(false);
  }
  return {
    el, isOn: () => on,
    toggle: () => (on ? disable() : enable()),
    /** The workout is running (true) or paused (false): the coach is silent while paused and starts listening afresh. */
    setRunning(r) {
      running = r; metro.stop(); lastBpm = 0;
      if (on) { cad.start(now()); if (noSensor) cad.setManual(getNum('bpm', 170, CAD.minBpm, CAD.maxBpm)); } // fresh and silent; a by-hand rhythm stays
      sync();
    },
    destroy() { if (on) disable(); },
  };
}
