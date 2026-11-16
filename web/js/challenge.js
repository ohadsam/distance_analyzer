// The weekly challenge ("N workouts this week") and the Sunday summary (pure). Weeks start on Sunday, like everywhere else in the app.
import { bucketize, weekStart, DAY } from './stats.js';

export const CHALLENGE_CHOICES = [0, 2, 3, 4, 5]; // 0 = off

/** Any stored value -> a valid target (0 = off). */
export const challengeTarget = (v) => (CHALLENGE_CHOICES.includes(Number(v)) ? Number(v) : 0);

/** { target, done, left, complete } for the week of `now`. */
export function challengeStatus(rows, now, target) {
  const t = challengeTarget(target);
  const done = rows.filter((w) => weekStart(w.startedAt) === weekStart(now)).length;
  return { target: t, done, left: Math.max(0, t - done), complete: t > 0 && done >= t };
}

/** The last `n` weeks (oldest first): [{ t, n, met }] against the target. */
export function challengeWeeks(rows, now, target, n = 8) {
  return bucketize(rows, 'week', n, now).map((b) => ({ t: b.t, n: b.n, met: target > 0 && b.n >= target }));
}

/** How many weeks in a row met the target, counting back from the last finished week (this week joins in once it is met). */
export function challengeStreak(rows, now, target) {
  if (!(target > 0)) return 0;
  const weeks = challengeWeeks(rows, now, target, 26); let i = weeks.length - 1, run = 0;
  if (!weeks[i].met) i--; // the running week does not break the streak while it is still going
  for (; i >= 0 && weeks[i].met; i--) run++;
  return run;
}

/** The last 7 days up to `now`: { n, km, minutes } (on a Sunday this is the week that just ended). */
export function weeklySummary(rows, now) {
  const ws = rows.filter((w) => w.startedAt > now - 7 * DAY && w.startedAt <= now);
  return { n: ws.length, km: Math.round(ws.reduce((s, w) => s + w.distanceM, 0) / 100) / 10, minutes: Math.round(ws.reduce((s, w) => s + w.movingMs, 0) / 60000) };
}

/** The next Sunday at `hour`:30 local time that is still ahead of `now` (ms). */
export function nextSundayAt(now, hour = 18) {
  const d = new Date(now); d.setHours(hour, 30, 0, 0); d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  if (d.getTime() <= now) d.setDate(d.getDate() + 7);
  return d.getTime();
}
export { DAY };
