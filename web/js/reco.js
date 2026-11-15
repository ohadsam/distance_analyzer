// Pure recommendations: (1) the best times to walk or run from the weather forecast AND the person's own routine, (2) recommendations from the
// effort bar, steps and streak. No DOM, no network, no clock: forecast, history and `now` are passed in. Text is produced by the UI from keys.
import { clamp } from './util.js';
import { dayStart, DAY } from './stats.js';

// ---------- comfort of an hour for an activity ----------
const IDEAL = { run: [6, 17], walk: [9, 23] }; // apparent temperature range (deg C) that feels good
export const GOOD = 70, OK = 50, BAD = 35;

/** { score 0-100, reasons: [keys of what is good], bad: [keys of what is wrong, worst first] } for one forecast hour. */
export function comfort(h, kind = 'walk') {
  const [lo, hi] = IDEAL[kind === 'run' ? 'run' : 'walk'], pen = {};
  pen.heat = h.feels > hi ? (h.feels - hi) * 5 : 0; pen.cold = h.feels < lo ? (lo - h.feels) * 3.5 : 0;
  pen.rain = (h.rainP >= 30 ? (h.rainP - 20) * 0.5 : 0) + (h.rain > 0.1 ? 15 + Math.min(20, h.rain * 10) : 0);
  pen.wind = h.wind > 20 ? (h.wind - 20) * 1.5 : 0; pen.uv = h.day && h.uv >= 7 ? (h.uv - 6) * 6 : 0; pen.dark = h.day ? 0 : 30;
  const score = Math.round(clamp(100 - Object.values(pen).reduce((s, x) => s + x, 0), 0, 100));
  const bad = Object.entries(pen).filter(([, v]) => v >= 8).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const reasons = []; if (!pen.heat && !pen.cold) reasons.push('temp'); if (!pen.rain && h.rainP < 20) reasons.push('dry'); if (!pen.wind && h.wind < 15) reasons.push('calm'); if (h.day) reasons.push('daylight');
  return { score, reasons, bad };
}

// ---------- the person's routine ----------
const HALF_LIFE = 28 * DAY, SPAN = 56 * DAY;
const startHour = (ts) => { const d = new Date(ts); return d.getHours(); };
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Habits from the last 8 weeks (recent workouts count more). Returns { n, habit(weekday, hour) in 0..1, sessions(weekday) 1..3,
 * typicalMin(kind), hours: top habitual start hours overall }. With fewer than 5 workouts there is no routine yet (n small -> the weather decides).
 */
export function routineProfile(rows, now) {
  const recent = rows.filter((w) => w.startedAt >= now - SPAN && w.startedAt <= now + DAY);
  const byDay = Array.from({ length: 7 }, () => new Array(24).fill(0)), all = new Array(24).fill(0), perDay = new Map();
  for (const w of recent) {
    const wt = Math.pow(0.5, Math.max(0, now - w.startedAt) / HALF_LIFE), d = new Date(w.startedAt).getDay(), h = startHour(w.startedAt);
    byDay[d][h] += wt; all[h] += wt; const key = dayStart(w.startedAt); perDay.set(key, (perDay.get(key) || 0) + 1);
  }
  const smooth = (a) => a.map((v, h) => v + 0.5 * (a[(h + 23) % 24] + a[(h + 1) % 24]));
  const sAll = smooth(all), maxAll = Math.max(1e-9, ...sAll), sDay = byDay.map(smooth);
  const dayTotal = byDay.map((a) => a.reduce((s, x) => s + x, 0));
  const habit = (d, h) => {
    const own = dayTotal[d] >= 1.5 ? Math.max(1e-9, ...sDay[d]) : 0; // enough workouts on that weekday: use the weekday's own pattern, else the overall one
    const hh = ((h % 24) + 24) % 24; return own ? clamp(sDay[d][hh] / own, 0, 1) : clamp(sAll[hh] / maxAll, 0, 1);
  };
  const counts = [...perDay.values()], overall = counts.length ? counts.reduce((s, x) => s + x, 0) / counts.length : 1;
  const sessions = (d) => { const days = new Map(); for (const w of recent) if (new Date(w.startedAt).getDay() === d) days.set(dayStart(w.startedAt), (days.get(dayStart(w.startedAt)) || 0) + 1); const v = days.size >= 2 ? [...days.values()].reduce((s, x) => s + x, 0) / days.size : overall; return clamp(Math.round(v), 1, 3); };
  const typicalMin = (kind) => Math.round(median(recent.filter((w) => w.kind === kind).map((w) => w.movingMs / 60000)) || (kind === 'run' ? 35 : 40));
  const hours = sAll.map((v, h) => [h, v]).filter(([, v]) => v / maxAll >= 0.6).sort((a, b) => b[1] - a[1]).map(([h]) => h).slice(0, 4);
  return { n: recent.length, habit, sessions, typicalMin, hours };
}

// ---------- the best times ----------
const MIN_ROUTINE = 5, WAKING = [6, 22];
const win = (hours, a, len) => hours.slice(a, a + len);

/**
 * forecast: normalised hourly list. Returns { hours: [{ t, hour, comfort, habit, fit }], items: [...] } for the remaining hours of `now`'s day (and
 * tomorrow when `tomorrow`). Items: { id, type: 'habit' | 'best' | 'avoid', day (0 today, 1 tomorrow), start, end (hours), score, reasons, bad, params }.
 *  - habit: near the person's usual hours and comfortable; best: the most comfortable windows overall; avoid: stretches that are poor.
 */
export function recommend(forecast, profile, kind, now, { tomorrow = false } = {}) {
  const today = dayStart(now), out = { hours: [], items: [] };
  const span = forecast.filter((h) => h.t >= now - 3600000 + 1 && h.t < today + (tomorrow ? 2 : 1) * DAY + 3600000 && new Date(h.t).getHours() >= WAKING[0] - 1);
  for (const h of span) {
    const c = comfort(h, kind), d = new Date(h.t), hab = profile.n >= MIN_ROUTINE ? profile.habit(d.getDay(), d.getHours()) : 0;
    out.hours.push({ t: h.t, hour: d.getHours(), day: dayStart(h.t) === today ? 0 : 1, comfort: c.score, habit: hab, fit: profile.n >= MIN_ROUTINE ? Math.round(c.score * 0.6 + hab * 40) : c.score, c, f: h });
  }
  const len = Math.max(1, Math.min(2, Math.ceil(profile.typicalMin(kind) / 60)));
  for (const day of tomorrow ? [0, 1] : [0]) {
    const hrs = out.hours.filter((h) => h.day === day && h.hour >= WAKING[0] && h.hour < WAKING[1]); if (!hrs.length) continue;
    const taken = new Set(), pick = (key, minScore) => {
      let best = null;
      for (let a = 0; a + len <= hrs.length; a++) {
        const w = win(hrs, a, len); if (w.some((h) => taken.has(h.hour))) continue; if (w[w.length - 1].hour - w[0].hour !== len - 1) continue; // contiguous
        const score = w.reduce((s, h) => s + h[key], 0) / len; if (score >= minScore && (!best || score > best.score)) best = { w, score };
      }
      return best;
    };
    const d0 = new Date(hrs[0].t).getDay(), wanted = profile.n >= MIN_ROUTINE ? profile.sessions(d0) : 1;
    for (let i = 0; i < wanted; i++) { // habit windows: best "fit" (comfort + routine)
      const b = pick('fit', OK); if (!b) break;
      b.w.forEach((h) => taken.add(h.hour)); const isHabit = profile.n >= MIN_ROUTINE && b.w[0].habit >= 0.4;
      out.items.push(item(isHabit ? 'habit' : 'best', day, b.w, b.score, kind));
    }
    for (let i = 0; i < 2; i++) { // general best times by weather alone (a different window from those above)
      const b = pick('comfort', GOOD - 10); if (!b) break; b.w.forEach((h) => taken.add(h.hour)); out.items.push({ ...item('best', day, b.w, b.score, kind), general: true });
    }
    let run = null; // avoid: contiguous poor hours
    for (const h of [...hrs, null]) {
      if (h && h.comfort < BAD) { run = run ? { ...run, hs: [...run.hs, h] } : { hs: [h] }; continue; }
      if (run && run.hs.length >= 2) { const worst = run.hs.flatMap((x) => x.c.bad)[0]; out.items.push({ id: `avoid-${day}-${run.hs[0].hour}`, type: 'avoid', day, start: run.hs[0].hour, end: run.hs[run.hs.length - 1].hour + 1, score: Math.round(run.hs.reduce((s, x) => s + x.comfort, 0) / run.hs.length), reasons: [], bad: worst ? [worst] : [], params: params(run.hs) }); }
      run = null;
    }
  }
  out.items.sort((a, b) => a.day - b.day || a.start - b.start);
  const merged = []; // neighbouring "good time" windows read better as one stretch (06:00-09:00)
  for (const it of out.items) { const p = merged[merged.length - 1]; if (p && it.type === 'best' && p.type === 'best' && p.day === it.day && p.end === it.start) { p.end = it.end; p.score = Math.round((p.score + it.score) / 2); p.reasons = [...new Set([...p.reasons, ...it.reasons])]; } else merged.push({ ...it }); }
  out.items = merged;
  return out;
}
const params = (hs) => ({ temp: Math.round(hs.reduce((s, h) => s + h.f.feels, 0) / hs.length), rain: Math.round(Math.max(...hs.map((h) => h.f.rainP))), wind: Math.round(Math.max(...hs.map((h) => h.f.wind))) });
const item = (type, day, w, score, kind) => ({ id: `${type}-${day}-${w[0].hour}-${kind}`, type, day, start: w[0].hour, end: w[w.length - 1].hour + 1, score: Math.round(score), reasons: [...new Set(w.flatMap((h) => h.c.reasons))], bad: [], params: params(w), habit: w[0].habit >= 0.4 });

// ---------- recommendations from the effort bar, steps and streak ----------
/**
 * ctx: { weekStatus (effort.weekStatus), steps: { today (quality), goal }, streak, daysSinceLast, hour, weekday (0 = Sunday) }.
 * Returns [{ id, area: 'effort' | 'steps' | 'routine', title, body, params, href }] (i18n keys), most useful first.
 */
export function generalRecs(ctx) {
  const out = [], st = ctx.weekStatus, left = Math.max(1, 7 - ctx.weekday), missing = Math.max(0, st.plan.minutes - st.done);
  if (st.status === 'behind' && ctx.weekday >= 2) out.push({ id: 'effort-behind', area: 'effort', title: 'rec_effort_behind_t', body: 'rec_effort_behind_b', params: { missing: Math.round(missing), per: Math.ceil(missing / left), days: left }, href: '#/d/effort' });
  if (st.status === 'ahead') out.push({ id: 'effort-ahead', area: 'effort', title: 'rec_effort_ahead_t', body: 'rec_effort_ahead_b', params: { done: st.done, plan: st.plan.minutes }, href: '#/d/effort' });
  if (st.share > 1.3) out.push({ id: 'effort-heavy', area: 'effort', title: 'rec_effort_heavy_t', body: 'rec_effort_heavy_b', params: { pct: Math.round(st.share * 100) }, href: '#/d/effort' });
  if (ctx.steps.goal > 0 && ctx.hour >= 16 && ctx.steps.today < ctx.steps.goal * 0.5) out.push({ id: 'steps-low', area: 'steps', title: 'rec_steps_low_t', body: 'rec_steps_low_b', params: { today: ctx.steps.today, goal: ctx.steps.goal }, href: '#/d/steps' });
  if (ctx.daysSinceLast >= 3 && ctx.daysSinceLast < 60) out.push({ id: 'restart', area: 'routine', title: 'rec_restart_t', body: 'rec_restart_b', params: { days: ctx.daysSinceLast }, href: '#/workout/walk' });
  if (ctx.streak >= 3) out.push({ id: 'streak', area: 'routine', title: 'rec_streak_t', body: 'rec_streak_b', params: { n: ctx.streak }, href: '#/d/consistency' });
  return out;
}
