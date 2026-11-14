// Thin wrapper over the Android WebView bridge (`DistanceNative`, see android/.../NativeBridge.kt).
// In a plain browser every method is a harmless no-op, so the rest of the app never branches on platform.
const B = globalThis.DistanceNative;
const call = (name, ...args) => { try { return B?.[name]?.(...args); } catch (e) { console.warn('native', name, e); } };

export const native = {
  available: !!B,
  version: () => call('appVersion'),
  /** Keeps the screen on during a workout. */
  keepAwake: (on) => call('keepAwake', !!on),
};

/** Native -> JS events: {type: ...}. */
export function onNativeEvent(fn) {
  globalThis.addEventListener('distance-native', (e) => fn(e.detail));
}
