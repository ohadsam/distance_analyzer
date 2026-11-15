// Runs while the app is open: fires the fixed reminders (walks, movement breaks) and the smart nudge into the alerts inbox / notifications.
// The decisions are pure (reminders.js); this file gathers the context and delivers. Android delivery while closed = future background service.
import { getJson, setJson, listWorkouts, profile } from './store.js';
import { sanitizeReminders, sanitizeSmart, dueReminders, smartNudge } from './reminders.js';
import { pushAlert } from './ui/notify.js';
import { t } from './i18n.js';
import { native } from './native.js';
import { planReminders } from './syncNative.js';
import { dayStart } from './stats.js';
import { stepSeries, recommendedSteps } from './steps.js';
import { weekStatus } from './effort.js';
import { active, getPref } from './store.js';
import { onlineOn, fetchForecast } from './weatherApi.js';
import { routineProfile, recommend } from './reco.js';

const TICK = 30000;
let last = Date.now(), timer = 0;

let busy = false;
export async function checkReminders(now = Date.now(), prevCheck = last) {
  if (busy) return; busy = true; // overlapping checks (timer + settings change) must not both read the same nudge counter
  try { await runChecks(now, prevCheck); } finally { busy = false; }
}
async function runChecks(now, prevCheck) {
  last = now;
  const list = sanitizeReminders(getJson('rems', [])), smart = sanitizeSmart(getJson('smart', {}));
  for (const r of dueReminders(list, prevCheck, now)) pushAlert({ id: `rem-${r.id}-${dayStart(now)}-${r.time}`, kind: 'reminder', title: r.kind === 'walk' ? 'rem_walk' : 'rem_move', lines: [r.kind === 'walk' ? 'rem_walk_body' : 'rem_move_body'], href: '#/workout/walk' });
  if (!native.available) for (const e of planReminders(prevCheck)) if (e.at <= now) pushAlert({ id: e.id, kind: 'reminder', title: 'planRemindTitle', lines: ['planRemindBody'], params: { what: t(`ty${e.meta.type[0].toUpperCase()}${e.meta.type.slice(1)}`), min: e.meta.min }, href: '#/plan' }); // in the browser: while the page is open (Android has the notification already)
  await smartPart(smart, now);
  await recoPart(now);
}

async function smartPart(smart, now) {
  const nd = getJson('nudge', {}), cheap = { lastMoveAt: 0, nudgesToday: nd.day === dayStart(now) ? nd.n | 0 : 0, lastNudgeAt: nd.last | 0, stepsToday: 0, goalSteps: 0, weekBehind: false, activeNow: !!active.load() };
  if (!smartNudge(smart, cheap, now)) return; // the hour, the daily cap, the spacing and a running workout are decided before any data is loaded
  const rows = await listWorkouts({ points: false }), prof = profile(), today = rows.filter((w) => dayStart(w.startedAt) === dayStart(now)), n = getJson('nudge', {});
  const day = dayStart(now), state = n.day === day ? n : { day, n: 0, last: 0 };
  const series = stepSeries(rows, 14, now, prof.heightCm, native.stepsDays()), st = weekStatus(rows, prof.age, now, getJson('barOv', null));
  const d = smartNudge(smart, { lastMoveAt: Math.max(0, ...today.map((w) => w.endedAt || w.startedAt)), nudgesToday: state.n, lastNudgeAt: state.last, stepsToday: series[series.length - 1].quality, goalSteps: recommendedSteps(series, prof.age), weekBehind: st.status === 'behind', activeNow: !!active.load() }, now);
  if (!d) return;
  setJson('nudge', { day, n: state.n + 1, last: now });
  pushAlert({ id: `nudge-${now}`, kind: 'reminder', title: d.kind === 'walk' ? 'rem_walk' : 'rem_move', lines: [d.why === 'behind' ? 'rem_behind_body' : 'rem_idle_body'], href: d.kind === 'walk' ? '#/workout/walk' : '' });
}

/** A notification shortly before the person's usual time when the forecast says the weather is good (opt-in; uses the saved forecast, at most one request an hour). */
let nextReco = 0;
async function recoPart(now) {
  if (getPref('recoNotify', '0') !== '1' || !onlineOn() || active.load() || now < nextReco) return;
  nextReco = now + 5 * 60000; // the routine and the forecast change slowly: look every 5 minutes, not every tick
  const day = dayStart(now), sent = getJson('recoSent', {}), ids = sent.day === day ? sent.ids || [] : [];
  const res = await fetchForecast({ now }); if (!res) return;
  const rows = await listWorkouts({ points: false }), kind = getPref('recoKind', 'walk') === 'run' ? 'run' : 'walk', prof = routineProfile(rows, now, kind);
  for (const i of recommend(res.list, prof, kind, now).items) {
    const startMs = new Date(day).setHours(i.start, 0, 0, 0); // local clock time (a clock-change day is not 24 h)
    if (i.type !== 'habit' || i.day !== 0 || i.comfort < 60 || ids.includes(i.id) || startMs - now > 45 * 60000 || startMs - now < 0) continue;
    setJson('recoSent', { day, ids: [...ids, i.id] });
    pushAlert({ id: `reco-${day}-${i.id}`, kind: 'reminder', title: `rec_notify_${kind}`, lines: ['rec_notify_body'], params: { range: `${String(i.start).padStart(2, '0')}:00-${String(i.end % 24).padStart(2, '0')}:00`, temp: i.params.temp }, href: '#/reco' });
    return;
  }
}

/** Checks every 30 s while the app is in front. Hidden: no work at all (Android delivers notifications itself while the app is closed); on return one check catches up on what was missed. */
export function startReminderLoop() {
  if (timer) return;
  const run = () => { if (!document.hidden) checkReminders().catch(() => { /* a failed check must never break the app */ }); };
  timer = setInterval(run, TICK); document.addEventListener('visibilitychange', run);
}
