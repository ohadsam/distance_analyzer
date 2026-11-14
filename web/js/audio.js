// The metronome engine: a look-ahead scheduler that plays clicks on the Web Audio clock (no drift, no jitter from timers).
// Beat times are on the performance.now() clock so the visuals (and tests with a fake clock) share one time base.
import { beatsBetween } from './metronome.js';

const LOOKAHEAD_MS = 120, TICK_MS = 25;

export function createMetronome() {
  let ctx = null, timer = 0, gain = null, anchor = 0, idx0 = 0, bpm = 0, until = 0, volume = 0.6, accent = null;

  const perf = () => performance.now();
  function click(tPerf, loud) {
    if (!ctx) return;
    const at = Math.max(ctx.currentTime, ctx.currentTime + (tPerf - perf()) / 1000);
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = loud ? 1500 : 1000;
    env.gain.setValueAtTime(0.0001, at); env.gain.exponentialRampToValueAtTime(loud ? 1 : 0.7, at + 0.004); env.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
    osc.connect(env); env.connect(gain); osc.start(at); osc.stop(at + 0.07);
  }
  function pump() {
    const now = perf();
    for (const b of beatsBetween(anchor, bpm, Math.max(until, now - 30), now + LOOKAHEAD_MS)) { click(b.t, accent?.(idx0 + b.i) === true); }
    until = now + LOOKAHEAD_MS;
  }
  return {
    get running() { return timer !== 0; },
    /** Starts (must be called from a user gesture the first time). `accentOf(i)` returns true for an accented beat (the first of a breath cycle). */
    start(newBpm, { vol = 0.6, accentOf = null } = {}) {
      this.stop(); bpm = newBpm; volume = vol; accent = accentOf;
      try { ctx ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)(); ctx.resume?.(); gain = ctx.createGain(); gain.gain.value = volume; gain.connect(ctx.destination); } catch { ctx = null; } // no audio: the visuals still run
      anchor = perf() + 60; idx0 = 0; until = 0; timer = setInterval(pump, TICK_MS); pump();
    },
    /** Changes the tempo at the next beat so the rhythm never stutters. */
    setBpm(n) {
      if (!timer || n === bpm) return;
      const iv = 60000 / bpm, k = Math.max(0, Math.ceil((Math.max(perf(), until) - anchor) / iv)); // first beat not yet scheduled
      idx0 += k; anchor += k * iv; bpm = n; // the new tempo starts exactly there
    },
    setVolume(v) { volume = v; if (gain) gain.gain.value = v; },
    /** Fractional beat number at time `t` (for the animation): integer part = beat index, fraction = progress to the next beat. */
    pos(t = perf()) { return timer ? idx0 + (t - anchor) / (60000 / bpm) : 0; },
    stop() { clearInterval(timer); timer = 0; try { gain?.disconnect(); } catch { /* already gone */ } gain = null; },
  };
}
