// Runs while the app is open: fires the fixed reminders (walks, movement breaks) and the smart nudge into the alerts inbox / notifications.
// The decisions are pure (reminders.js); this file gathers the context and delivers. Android delivery while closed = future background service.
import { getJson, setJson, listWorkouts, profile } from './store.js';
import { sanitizeReminders, sanitizeSmart, dueReminders, smartNudge } from './reminders.js';
import { pushAlert } from './ui/notify.js';
import { dayStart } from './stats.js';
import { stepSeries, recommendedSteps } from './steps.js';
import { weekStatus } from './effort.js';
import { active } from './store.js';

const TICK = 30000;
let last = Date.now(), timer = 0;

export async function checkReminders(now = Date.now(), prevCheck = last) {
  last = now;
  const list = sanitizeReminders(getJson('rems', [])), smart = sanitizeSmart(getJson('smart', {}));
  for (const r of dueReminders(list, prevCheck, now)) pushAlert({ id: `rem-${r.id}-${dayStart(now)}-${r.time}`, kind: 'reminder', title: r.kind === 'walk' ? 'rem_walk' : 'rem_move', lines: [r.kind === 'walk' ? 'rem_walk_body' : 'rem_move_body'], href: '#/workout/walk' });
  if (!smart.on) return;
  const rows = await listWorkouts(), prof = profile(), today = rows.filter((w) => dayStart(w.startedAt) === dayStart(now)), n = getJson('nudge', {});
  const day = dayStart(now), state = n.day === day ? n : { day, n: 0, last: 0 };
  const series = stepSeries(rows, 14, now, prof.heightCm), st = weekStatus(rows, prof.age, now, getJson('barOv', null));
  const d = smartNudge(smart, { lastMoveAt: Math.max(0, ...today.map((w) => w.endedAt || w.startedAt)), nudgesToday: state.n, lastNudgeAt: state.last, stepsToday: series[series.length - 1].quality, goalSteps: recommendedSteps(series, prof.age), weekBehind: st.status === 'behind', activeNow: !!active.load() }, now);
  if (!d) return;
  setJson('nudge', { day, n: state.n + 1, last: now });
  pushAlert({ id: `nudge-${now}`, kind: 'reminder', title: d.kind === 'walk' ? 'rem_walk' : 'rem_move', lines: [d.why === 'behind' ? 'rem_behind_body' : 'rem_idle_body'], href: d.kind === 'walk' ? '#/workout/walk' : '' });
}
export function startReminderLoop() { if (!timer) timer = setInterval(() => { checkReminders().catch(() => { /* a failed check must never break the app */ }); }, TICK); }
