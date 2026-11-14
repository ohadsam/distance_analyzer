// The in-app notification inbox. Alerts store keys + params (not finished sentences) so they follow a language switch.
// Pure part (sanitise, add, mark) + a thin localStorage persistence. Delivery to the system (Notification API / Android) is in ui/notify.js.
import { clamp, cleanText } from './util.js';

export const MAX_ALERTS = 100;
const KEY = 'da.alerts';
const keyOk = (k) => /^[a-zA-Z0-9_]{1,40}$/.test(k);

export function sanitizeAlerts(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_ALERTS).map((a) => {
    if (!a || typeof a !== 'object' || !keyOk(String(a.title))) return null;
    const params = {}; for (const [k, v] of Object.entries(a.params && typeof a.params === 'object' ? a.params : {}).slice(0, 12)) if (keyOk(k)) params[k] = typeof v === 'number' ? v : cleanText(v, 40);
    return { id: cleanText(a.id, 40), ts: clamp(Number(a.ts) || 0, 0, 4e12), kind: ['effort', 'reminder', 'info'].includes(a.kind) ? a.kind : 'info', level: ['notice', 'warn'].includes(a.level) ? a.level : 'notice',
      title: String(a.title), lines: Array.isArray(a.lines) ? a.lines.slice(0, 6).filter(keyOk) : [], params, href: /^#\/[\w/-]{0,60}$/.test(String(a.href || '')) ? a.href : '', read: a.read === true };
  }).filter((a) => a && a.id);
}
/** Newest first, bounded, same id replaced. */
export const addAlert = (list, a) => [a, ...list.filter((x) => x.id !== a.id)].slice(0, MAX_ALERTS);
export const unreadCount = (list) => list.filter((a) => !a.read).length;
export const markAllRead = (list) => list.map((a) => ({ ...a, read: true }));

export const alertStore = {
  load() { try { return sanitizeAlerts(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return []; } },
  save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked: alerts live for this session only */ } },
};
