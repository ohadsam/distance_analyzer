// Pure statistics over saved workouts (no DOM, no storage): filtering, grouping by day/week, trends, personal bests, weather buckets.
// A workout is the record from workout.js#summarize: { kind, startedAt, distanceM, movingMs, elapsedMs, splits, weather? }.
export const DAY = 86400000, WEEK = 7 * DAY;

/** Local midnight (ms) of the day containing t. */
export const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Start of the week (Sunday, as in Israel) containing t. */
export const weekStart = (t) => { const d = new Date(dayStart(t)); d.setDate(d.getDate() - d.getDay()); return d.getTime(); };

export const speedKmh = (w) => (w.movingMs > 0 ? (w.distanceM / 1000) / (w.movingMs / 3600000) : 0);
export const paceSec = (w) => (w.distanceM >= 20 ? w.movingMs / 1000 / (w.distanceM / 1000) : 0);

/** Filter: { since (ms), until (ms), kind ('walk'|'run'|''), text, weather ('' | bucket id) }. Text is matched against the searchable string of the workout. */
export function filterWorkouts(rows, f = {}, haystack = () => '') {
  const q = (f.text || '').trim().toLowerCase();
  return rows.filter((w) => (!f.since || w.startedAt >= f.since) && (!f.until || w.startedAt < f.until) && (!f.kind || w.kind === f.kind)
    && (!f.weather || weatherBucket(w.weather) === f.weather) && (!q || haystack(w).toLowerCase().includes(q)));
}

export function totals(rows) {
  return rows.reduce((a, w) => ({ n: a.n + 1, distanceM: a.distanceM + w.distanceM, movingMs: a.movingMs + w.movingMs, longestM: Math.max(a.longestM, w.distanceM) }), { n: 0, distanceM: 0, movingMs: 0, longestM: 0 });
}

/** Buckets by the start of the day/week: [{ t, distanceM, movingMs, n }] for the `count` periods ending at `now`, oldest first, empty ones included. */
export function bucketize(rows, unit, count, now) {
  const step = unit === 'week' ? WEEK : DAY, startOf = unit === 'week' ? weekStart : dayStart;
  const last = startOf(now), out = [];
  for (let i = count - 1; i >= 0; i--) { const d = new Date(last); if (unit === 'week') d.setDate(d.getDate() - 7 * i); else d.setDate(d.getDate() - i); out.push({ t: d.getTime(), distanceM: 0, movingMs: 0, n: 0 }); }
  for (const w of rows) {
    const s = startOf(w.startedAt), b = out.find((x) => x.t === s);
    if (b) { b.distanceM += w.distanceM; b.movingMs += w.movingMs; b.n++; }
  }
  return out;
}

/** Days (local midnight ms) that have at least one workout. */
export const activeDays = (rows) => [...new Set(rows.map((w) => dayStart(w.startedAt)))].sort((a, b) => a - b);

/** Current streak of consecutive active days ending today or yesterday. */
export function streak(rows, now) {
  const days = new Set(activeDays(rows)), d = new Date(dayStart(now)); let n = 0;
  if (!days.has(d.getTime())) d.setDate(d.getDate() - 1); // today may still come
  while (days.has(d.getTime())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Personal bests: longest workout, best average pace (>= 1 km), fastest single km. */
export function personalBests(rows) {
  let longest = null, fastest = null, bestKm = null;
  for (const w of rows) {
    if (!longest || w.distanceM > longest.distanceM) longest = w;
    if (w.distanceM >= 1000 && (!fastest || paceSec(w) < paceSec(fastest))) fastest = w;
    (w.splits || []).forEach((s, i) => { const ms = s.atMs - (i ? w.splits[i - 1].atMs : 0); if (ms > 0 && (!bestKm || ms < bestKm.ms)) bestKm = { ms, w, km: s.km }; });
  }
  return { longest, fastest, bestKm };
}

// ---- weather ----
export const WEATHER = ['clear', 'cloudy', 'rain', 'windy'];
/** Weather bucket id of a workout's weather: temperature band + rain/wind; 'none' when unknown. */
export function weatherBucket(wx) {
  if (!wx || !Number.isFinite(wx.tempC)) return 'none';
  if (wx.cond === 'rain') return 'rain';
  return wx.tempC < 10 ? 'cold' : wx.tempC < 18 ? 'cool' : wx.tempC < 26 ? 'mild' : 'hot';
}
export const WEATHER_BUCKETS = ['cold', 'cool', 'mild', 'hot', 'rain'];

/** Average pace and count per weather bucket (only workouts with weather and >= 1 km). */
export function paceByWeather(rows) {
  const acc = {};
  for (const w of rows) {
    const b = weatherBucket(w.weather); if (b === 'none' || w.distanceM < 1000) continue;
    (acc[b] ||= { n: 0, sec: 0 }); acc[b].n++; acc[b].sec += paceSec(w);
  }
  return WEATHER_BUCKETS.filter((b) => acc[b]).map((b) => ({ bucket: b, n: acc[b].n, paceSec: acc[b].sec / acc[b].n }));
}
