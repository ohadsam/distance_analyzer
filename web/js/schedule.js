// Pure planning of the notifications that Android fires while the app is closed. The web app expands what it knows (fixed reminders for the next
// days, the recommended walk times from the saved forecast) into a flat list and hands it over; Android only stores it and wakes at the right time.
// Texts are resolved here (in the language in use now), so Android needs no translations. Smart "no movement" nudges need live data and stay in-app.
import { sanitizeReminders } from './reminders.js';

export const MAX_ITEMS = 60, HORIZON_DAYS = 7;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

/**
 * reminders: stored list; text(kind) -> { title, body }. Returns [{ id, at, title, body, href }] for the next HORIZON_DAYS days, soonest first.
 */
export function reminderEntries(reminders, now, text) {
  const out = [];
  for (const r of sanitizeReminders(reminders)) {
    if (!r.on) continue;
    const [hh, mm] = r.time.split(':').map(Number);
    for (let i = 0; i < HORIZON_DAYS + 1; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(hh, mm, 0, 0);
      if (d.getTime() > now && r.days.includes(d.getDay())) { const x = text(r.kind); out.push({ id: `rem-${r.id}-${ymd(d)}`, at: d.getTime(), title: x.title, body: x.body, href: '#/workout/walk' }); }
    }
  }
  return out;
}

/** items: recommendations (habit type, with day, start hour, comfort, params.temp); one "good time soon" notification 30 minutes before each, if still ahead. */
export function recoEntries(items, now, text) {
  const out = [], base = new Date(now); base.setHours(0, 0, 0, 0);
  for (const i of items) {
    if (i.type !== 'habit' || !(i.comfort >= 60)) continue;
    const d = new Date(base); d.setDate(d.getDate() + i.day); d.setHours(i.start, 0, 0, 0);
    const at = d.getTime() - 30 * 60000; if (at <= now) continue;
    const x = text(i); out.push({ id: `reco-${ymd(d)}-${i.start}`, at, title: x.title, body: x.body, href: '#/reco' });
  }
  return out;
}

/** Merges, sorts by time and bounds the list. */
export const buildSchedule = (...lists) => lists.flat().sort((a, b) => a.at - b.at).slice(0, MAX_ITEMS);
