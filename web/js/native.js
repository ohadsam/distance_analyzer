// Thin wrapper over the Android WebView bridge (`StepUpNative`, see android/.../NativeBridge.kt).
// In a plain browser every method is a harmless no-op, so the rest of the app never branches on platform.
const B = globalThis.StepUpNative;
const call = (name, ...args) => { try { return B?.[name]?.(...args); } catch (e) { console.warn('native', name, e); } };

export const native = {
  available: !!B,
  version: () => call('appVersion'),
  /** Background tracking (Android foreground service). trackStart returns false while the location permission is missing (it asks); the page keeps its own GPS meanwhile. */
  trackAvailable: () => call('trackAvailable') === true,
  trackStart: (title, text) => call('trackStart', String(title).slice(0, 60), String(text).slice(0, 120)) === true,
  trackStop: () => call('trackStop'),
  /** Fixes recorded since the last call: [[lat, lon, t(ms), accuracy], ...] (oldest first). */
  trackDrain: () => { try { const a = JSON.parse(call('trackDrain') || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } },
  /** All-day steps from the phone's step sensor. */
  stepsAvailable: () => call('stepsAvailable') === true,
  stepsSample: () => call('stepsSample'),
  stepsDays: () => { try { const o = JSON.parse(call('stepsDays') || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } },
  requestActivity: () => call('requestActivity'),
  /** Notifications that fire while the app is closed: replaces the whole schedule [{id, at(ms), title, body, href}]. */
  notificationsAllowed: () => call('notificationsAllowed') === true,
  requestNotifications: () => call('requestNotifications'),
  /** Goals and texts for the home-screen widgets (the steps themselves come from the phone's sensor). */
  setWidgetData: (o) => call('setWidgetData', JSON.stringify(o)),
  setNotifications: (list) => call('setNotifications', JSON.stringify(list)),
  /** The "#/route" a tapped notification asked for (once), or ''. */
  takePendingHref: () => { const h = call('takePendingHref'); return typeof h === 'string' && /^#\/[\w/-]{0,60}$/.test(h) ? h : ''; },
  /** Keeps the screen on during a workout. */
  keepAwake: (on) => call('keepAwake', !!on),
};

/** Native -> JS events: {type: ...}. */
export function onNativeEvent(fn) {
  globalThis.addEventListener('stepup-native', (e) => fn(e.detail));
}
