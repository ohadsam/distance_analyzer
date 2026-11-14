// Synthetic accelerometer signal for tests: a foot strike every `gapMs` (with optional jitter), gravity + noise. Returns samples [t, ax, ay, az].
export function runSignal({ fromMs = 0, toMs, gapMs, jitter = 0, amp = 6, hz = 50, seed = 1 }) {
  let s = seed; const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) - 0.5;
  const strikes = []; for (let t = fromMs + gapMs; t < toMs; t += gapMs + rnd() * 2 * jitter) strikes.push(t);
  const out = [];
  for (let t = fromMs; t < toMs; t += 1000 / hz) {
    let v = 0; for (const k of strikes) { const d = t - k; if (d >= 0 && d < 160) v += amp * Math.sin((Math.PI * d) / 160); }
    out.push([t, 0.4 * rnd(), 9.8 + v + 0.3 * rnd(), 0.4 * rnd()]);
  }
  return out;
}
