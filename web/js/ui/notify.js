// Delivery of alerts and reminders: always into the in-app inbox, and as a system notification when the person allowed it and the page can show one.
import { t } from '../i18n.js';
import { alertStore, addAlert } from '../alerts.js';

/** alert: { id, kind, level, title, lines, params, href }. Stores it and (optionally) shows a system notification. */
export function pushAlert(alert, { system = true } = {}) {
  const a = { ts: Date.now(), read: false, kind: 'info', level: 'notice', lines: [], params: {}, href: '', ...alert };
  alertStore.save(addAlert(alertStore.load(), a));
  dispatchEvent(new CustomEvent('stepup-alerts'));
  if (system) showSystem(t(a.title, a.params), a.lines[0] ? t(a.lines[0], a.params) : '', a.id);
  return a;
}
function showSystem(title, body, tag) {
  try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, tag, icon: 'icons/icon-192.png', lang: document.documentElement.lang }); } catch { /* not allowed here: the inbox has it */ }
}
export const notifyState = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
export const askNotify = async () => { try { return await Notification.requestPermission(); } catch { return 'denied'; } };
