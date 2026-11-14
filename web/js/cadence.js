// Pure cadence logic for the smart metronome: accelerometer samples -> footsteps -> a steady cadence (steps per minute).
// No DOM, no sensors, no clock: every function gets its times (ms) as arguments, so it is fully unit-testable.
export const CAD = {
  minBpm: 100, maxBpm: 230, minGapMs: 250,        // human running/walking-fast range, and the shortest believable step gap
  learnMs: 20000, stableMs: 8000,                  // watch silently this long, then the rhythm must stay steady this long
  windowSteps: 14, maxCv: 0.07,                    // steady = the last 14 step gaps vary by at most 7 % (robust)
  driftPct: 0.06, relockMs: 16000, lostMs: 5000,   // a new steady cadence 6 % away for 16 s re-locks; no steps for 5 s = stopped
  minAmp: 1.2,                                     // m/s^2 of vertical shake that counts as a foot strike
};

/** Step detector: feed (t, ax, ay, az) in m/s^2 (gravity included). Returns the step time (ms) when a foot strike is seen, else 0. */
export function createStepDetector() {
  let base = 9.8, sm = 0, env = 0, last = 0, armed = true, lastT = 0, started = false;
  return function push(t, ax, ay, az) {
    const mag = Math.hypot(ax, ay, az); if (!Number.isFinite(mag)) return 0;
    const dt = started ? Math.max(1, t - lastT) : 16; lastT = t;
    if (!started) { base = mag; sm = 0; started = true; }
    base += (mag - base) * Math.min(1, dt / 1500);                 // slow baseline = gravity + orientation
    sm += ((mag - base) - sm) * Math.min(1, dt / 40);              // light low-pass over the dynamic part
    env = Math.max(Math.abs(sm), env * Math.exp(-dt / 3000));      // envelope of recent strikes (decays over ~3 s)
    const thr = Math.max(CAD.minAmp, env * 0.5);
    if (armed && sm > thr && t - last >= CAD.minGapMs) { armed = false; last = t; return t; }
    if (!armed && sm < thr * 0.3) armed = true;
    return 0;
  };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Cadence state machine. States: 'off' -> 'learning' (silent) -> 'locked' (metronome sounds at `bpm`).
 * Back to 'learning' when the runner stops. Re-locks (not instantly) when the runner settles into a clearly different cadence.
 */
export function createCadence(now = 0) {
  const c = { state: 'off', bpm: 0, measured: 0, startedAt: now, steadySince: 0, newSince: 0, manual: false, newBpm: 0, steps: [] };

  const gaps = () => { const g = []; for (let i = 1; i < c.steps.length; i++) g.push(c.steps[i] - c.steps[i - 1]); return g; };
  function measure() { // robust cadence + steadiness of the recent step gaps, or null
    const g = gaps(); if (g.length < 8) return null;
    const m = median(g), good = g.filter((x) => x > m * 0.7 && x < m * 1.3); // drop a missed or doubled detection
    if (good.length < g.length * 0.75) return { bpm: 0, steady: false };
    const mean = good.reduce((s, x) => s + x, 0) / good.length;
    const cv = Math.sqrt(good.reduce((s, x) => s + (x - mean) ** 2, 0) / good.length) / mean;
    const bpm = Math.round(60000 / median(good));
    return { bpm, steady: cv <= CAD.maxCv && bpm >= CAD.minBpm && bpm <= CAD.maxBpm };
  }

  return {
    get snapshot() { return { state: c.state, bpm: c.bpm, measured: c.measured }; },
    start(t) { c.state = 'learning'; c.startedAt = t; c.steadySince = 0; c.steps = []; c.bpm = 0; c.measured = 0; c.newSince = 0; c.manual = false; },
    stop() { c.state = 'off'; c.bpm = 0; c.measured = 0; c.steps = []; c.manual = false; },
    /** Manual rhythm (sensor missing, or the person set it): locks immediately. */
    setManual(bpm) { c.state = 'locked'; c.bpm = Math.min(CAD.maxBpm, Math.max(CAD.minBpm, Math.round(bpm))); c.manual = true; c.newSince = 0; },
    step(t) { if (c.state === 'off') return; c.steps.push(t); if (c.steps.length > CAD.windowSteps) c.steps.shift(); this.tick(t); },
    /** Call about once a second (and after every step). */
    tick(t) {
      if (c.state === 'off') return;
      const last = c.steps[c.steps.length - 1] || c.startedAt;
      if (t - last > CAD.lostMs) { // stopped: silence until a new steady rhythm shows up
        if (c.state === 'locked' && !c.manual) { c.state = 'learning'; c.startedAt = t; c.bpm = 0; }
        c.steadySince = 0; c.measured = 0; c.steps = c.steps.filter((x) => t - x < CAD.lostMs); return;
      }
      const m = measure(); c.measured = m ? m.bpm : 0;
      if (c.state === 'learning') { // (a manual rhythm is never replaced by the sensor: it skips the re-lock branch below)
        if (m?.steady) { c.steadySince ||= t; if (t - c.startedAt >= CAD.learnMs && t - c.steadySince >= CAD.stableMs) { c.state = 'locked'; c.bpm = m.bpm; c.newSince = 0; } }
        else c.steadySince = 0;
      } else if (c.state === 'locked' && !c.manual && m?.steady && Math.abs(m.bpm - c.bpm) / c.bpm > CAD.driftPct) {
        if (Math.abs(m.bpm - c.newBpm) > 2) { c.newBpm = m.bpm; c.newSince = t; } // a new steady value: start counting again
        else if (t - c.newSince >= CAD.relockMs) { c.bpm = m.bpm; c.newSince = 0; }
      } else c.newSince = 0;
    },
  };
}

/** How the runner compares with the locked rhythm: 'on' | 'fast' | 'slow' | '' (unknown). */
export function rhythmHint(bpm, measured) {
  if (!bpm || !measured) return '';
  const d = (measured - bpm) / bpm;
  return Math.abs(d) <= 0.03 ? 'on' : d > 0 ? 'fast' : 'slow';
}
