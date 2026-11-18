// Thin wrapper over the Android WebView bridge (`StepUpNative`, see android/.../NativeBridge.kt).
// In a plain browser every method is a harmless no-op, so the rest of the app never branches on platform.
const B = globalThis.StepUpNative;
const call = (name, ...args) => { try { return B?.[name]?.(...args); } catch (e) { console.warn('native', name, e); } };

/** The next native event of this type ({ type, ok }). */
const nativeOnce = (type) => new Promise((res) => { const f = (e) => { if (e.detail?.type === type) { globalThis.removeEventListener('stepup-native', f); res(e.detail); } }; globalThis.addEventListener('stepup-native', f); });

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
  /** Notifications that fire while the app is closed: replaces the whole schedule [{id, at(ms), title, body, href}]. */
  /** Goals and texts for the home-screen widgets (the steps themselves come from the phone's sensor). */
  setWidgetData: (o) => call('setWidgetData', JSON.stringify(o)),
  setNotifications: (list) => call('setNotifications', JSON.stringify(list)),
  /** The "#/route" a tapped notification asked for (once), or ''. */
  takePendingHref: () => { const h = call('takePendingHref'); return typeof h === 'string' && /^#\/[\w/-]{0,60}$/.test(h) ? h : ''; },
  /** Backup files through Android's own file dialogs. Each resolves with { ok } when the dialog closes; takeBackup then returns the chosen file's text once. */
  saveBackup: (json, name) => (call('saveBackup', json, name) === true ? nativeOnce('backup-saved') : Promise.resolve({ ok: false, refused: true })),
  pickBackup: () => (call('pickBackup') === true ? nativeOnce('backup-picked') : Promise.resolve({ ok: false, reason: 'error' })),
  takeBackup: () => { const s = call('takeBackup'); return typeof s === 'string' ? s : ''; },
  /** The camera (Android: the camera app through a system dialog; the page shows no photo of its own). takePhoto resolves { ok } when it closes, then takenPhoto() returns a data URL once. */
  takePhoto: () => (call('takePhoto') === true ? nativeOnce('photo-taken') : Promise.resolve({ ok: false })),
  takenPhoto: () => { const s = call('takenPhoto'); return typeof s === 'string' && s.startsWith('data:image/jpeg;base64,') ? s : ''; },
  /** Shares a PNG (base64, no prefix) with Android's share sheet; true when handed over. */
  shareImage: (b64) => call('shareImage', String(b64)) === true,
  /** Spoken kilometre times from the background service while the screen is off: { on, lang, tpl, dist, moving }. */
  setVoice: (o) => call('setVoice', JSON.stringify(o)),
  /** A GPX file through Android's "save as" dialog; resolves { ok } when it closes. */
  saveGpx: (text, name) => (call('saveGpx', text, name) === true ? nativeOnce('gpx-saved') : Promise.resolve({ ok: false, refused: true })),
  /** While the workout screen is up, the volume keys are ours (volume-down = pause / resume, volume-up = say the numbers). */
  handsFree: (on) => call('handsFree', !!on),
  /** What the phone allows: { location, notifications, activity, battery, install } -> 'granted' | 'ask' | 'blocked' | 'unsupported' ({} outside the app). */
  permissionState: () => { try { const o = JSON.parse(call('permissionState') || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } },
  /** Android's own dialog (or the phone's settings screen when it will not ask again). The answer comes back as a 'permissions-changed' event. */
  requestPermission: (name) => call('requestPermission', String(name).slice(0, 20)),
  openAppSettings: () => call('openAppSettings'),
  /** In-app update: downloads, verifies and installs the release APK as an update. true when started; progress arrives as { type: 'update', state, pct, reason } events. */
  updateStart: (url) => call('updateStart', String(url).slice(0, 200)) === true,
  updateRunning: () => call('updateRunning') === true,
  /** Keeps the screen on during a workout. */
  keepAwake: (on) => call('keepAwake', !!on),
  /** Android's share sheet with a plain text; true only when the bridge accepted it. */
  share: (text) => call('share', String(text).slice(0, 600)) === true,
};

/** Native -> JS events: {type: ...}. */
export function onNativeEvent(fn) {
  const on = (e) => fn(e.detail); globalThis.addEventListener('stepup-native', on);
  return () => globalThis.removeEventListener('stepup-native', on);
}
