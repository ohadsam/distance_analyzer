// Pure rhythm logic: beat times and the breathing pattern that rides on the beats. No audio, no DOM, no clock.
export const BREATH = { '3:2': [3, 2], '2:2': [2, 2], '2:1': [2, 1], off: null };

/** Beat times (ms) of a metronome anchored at `anchor` with `bpm`, inside [from, to). */
export function beatsBetween(anchor, bpm, from, to) {
  const iv = 60000 / bpm, out = [];
  for (let k = Math.max(0, Math.ceil((from - anchor) / iv)); anchor + k * iv < to; k++) out.push({ t: anchor + k * iv, i: k });
  return out;
}

/** Where beat number `i` sits in the breathing cycle: {phase:'in'|'out', step, of, first} (first = first beat of the cycle). */
export function breathAt(i, pattern) {
  const p = BREATH[pattern]; if (!p) return { phase: 'none', step: 0, of: 0, first: i % 4 === 0 };
  const n = p[0] + p[1], k = ((i % n) + n) % n;
  return k < p[0] ? { phase: 'in', step: k, of: p[0], first: k === 0 } : { phase: 'out', step: k - p[0], of: p[1], first: false };
}

/** 0..1 lung fullness at fractional beat position `x` (smooth ramp up while breathing in, down while out). */
export function lungAt(x, pattern) {
  const p = BREATH[pattern]; if (!p) return 0.5;
  const n = p[0] + p[1], k = ((x % n) + n) % n;
  return k < p[0] ? k / p[0] : 1 - (k - p[0]) / p[1];
}
