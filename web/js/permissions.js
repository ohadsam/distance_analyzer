// What the app asks the phone or the browser for, and what is allowed now. Pure rules (which are missing) plus thin adapters: Android answers through the native
// bridge, a browser through its Permissions API. Nothing here shows anything: ui/permissions.js draws the Settings section and the start-up sheet.
import { native, onNativeEvent } from './native.js';
import { locate } from './weatherApi.js';

/** The list, in the order the person sees it. `android` = only in the app; `required` = worth asking for at start-up. */
export const PERMS = [
  { id: 'location', icon: 'gps', required: true }, { id: 'notifications', icon: 'bell', required: true },
  { id: 'activity', icon: 'steps', required: true, android: true }, { id: 'battery', icon: 'battery', required: false, android: true },
];
const STATES = ['granted', 'ask', 'blocked', 'unsupported'];
export const normState = (s) => (STATES.includes(s) ? s : 'unsupported');

/** The permissions that are still missing (asked-for ones only): not allowed yet, or blocked. */
export const missing = (list) => list.filter((p) => p.required && (p.state === 'ask' || p.state === 'blocked'));

/** Browser side: the state of one permission by its Permissions API name ('granted' | 'prompt' | 'denied'); unknown when the browser cannot say. */
async function webState(name, nav = globalThis.navigator) {
  try { const s = await nav.permissions.query({ name }); return s.state === 'granted' ? 'granted' : s.state === 'denied' ? 'blocked' : 'ask'; } catch { return null; }
}
/** [{ ...PERMS entry, state }] for what exists here (no Android-only rows in a browser). `env` is injectable for tests. */
export async function permissionList(env = {}) {
  const { app = native, nav = globalThis.navigator, Notif = globalThis.Notification } = env, out = [];
  const raw = app.available ? app.permissionState() : null;
  for (const p of PERMS) {
    if (p.android && !app.available) continue;
    let state;
    if (raw) state = normState(raw[p.id]);
    else if (p.id === 'notifications') state = !Notif ? 'unsupported' : Notif.permission === 'granted' ? 'granted' : Notif.permission === 'denied' ? 'blocked' : 'ask';
    else state = (await webState('geolocation', nav)) ?? (nav?.geolocation ? 'ask' : 'unsupported');
    if (state !== 'unsupported') out.push({ ...p, state });
  }
  return out;
}

/** Asks for one permission the way this platform does. Resolves when the answer is in (Android: when its 'permissions-changed' event arrives, or after 60 s). */
export function requestPermission(id, env = {}) {
  const { app = native, Notif = globalThis.Notification, locateFn = locate } = env;
  if (app.available) return new Promise((res) => { let off; const done = () => { clearTimeout(timer); off(); res(); }, timer = setTimeout(done, 60000); off = onNativeEvent((e) => { if (e?.type === 'permissions-changed') done(); }); app.requestPermission(id); });
  if (id === 'notifications') return Promise.resolve().then(() => Notif?.requestPermission?.()).catch(() => {}); // (old browsers answer through a callback and return nothing)
  if (id === 'location') return locateFn().then(() => {}, () => {}); // the browser's own prompt
  return Promise.resolve();
}
/**
 * Calls `fn` once after a permission may have changed: Android's event (also sent when the app comes back from a settings screen), a browser's own permission change,
 * or the page coming back to the front (browsers only: the app gets the native event). Bursts count as one. Returns the unsubscribe function.
 */
export function onPermissionsChanged(fn, nav = globalThis.navigator) {
  let timer = 0, stopped = false; const fire = () => { clearTimeout(timer); timer = setTimeout(fn, 120); };
  const offNative = onNativeEvent((e) => { if (e?.type === 'permissions-changed') fire(); }), onShow = () => { if (!document.hidden) fire(); }, watched = [];
  if (!native.available) {
    document.addEventListener('visibilitychange', onShow);
    for (const name of ['geolocation', 'notifications']) nav?.permissions?.query({ name }).then((s) => { if (stopped) return; s.onchange = fire; watched.push(s); }).catch(() => {}); // (the queries answer later: a list closed meanwhile must not get a listener)
  }
  return () => { stopped = true; clearTimeout(timer); offNative(); document.removeEventListener('visibilitychange', onShow); for (const s of watched) s.onchange = null; };
}
