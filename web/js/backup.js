// Backup and restore: one JSON file with the workouts, routes and settings. Everything read back is untrusted: it goes through the same sanitisers as storage.
import { sanitizeWorkout } from './workout.js';
import { sanitizeRoute, MAX_ROUTES } from './route.js';
import { MAX_WORKOUTS, listWorkouts, listRoutes, saveWorkout, saveRoute, updateWorkout, setPref } from './store.js';
import { APP_VERSION } from './appVersion.js';

export const MAX_BACKUP_CHARS = 20_000_000, MAKE_LIMIT_CHARS = 18_000_000; // a file we make must always be one we accept again
/** Settings that are not part of a backup: the work in progress and everything about where the person is. */
const SKIP = new Set(['active', 'loc', 'onlineWx', 'wxfail', 'wxc', 'recoSent', 'nudge']);
const KEY = /^[A-Za-z0-9]{1,30}$/;

/** { prefs } from a storage-like object (keys "da.<name>"). */
export function collectPrefs(storage) {
  const prefs = {};
  try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k?.startsWith('da.')) { const name = k.slice(3), v = storage.getItem(k); if (KEY.test(name) && !SKIP.has(name) && typeof v === 'string' && v.length <= 20000) prefs[name] = v; } } } catch { /* blocked */ }
  return prefs;
}

/** points: false keeps every workout's summary but not its route points (the fallback when the full file would be too big). */
export async function buildBackup(storage = globalThis.localStorage, { points = true } = {}) {
  return { format: 'stepup-backup', v: 1, appVersion: APP_VERSION, at: Date.now(), prefs: collectPrefs(storage), workouts: await listWorkouts({ points }), routes: await listRoutes() };
}

/** Untrusted text -> { workouts, routes, prefs } (all cleaned and bounded) or { error }. */
export function parseBackup(text) {
  if (typeof text !== 'string' || !text.length || text.length > MAX_BACKUP_CHARS) return { error: 'size' };
  let o; try { o = JSON.parse(text); } catch { return { error: 'format' }; }
  if (!o || o.format !== 'stepup-backup' || o.v !== 1) return { error: 'format' };
  const workouts = (Array.isArray(o.workouts) ? o.workouts.slice(0, MAX_WORKOUTS) : []).map(sanitizeWorkout).filter(Boolean);
  const routes = (Array.isArray(o.routes) ? o.routes.slice(0, MAX_ROUTES) : []).map(sanitizeRoute).filter(Boolean);
  const prefs = {}; let n = 0;
  if (o.prefs && typeof o.prefs === 'object') for (const [k, v] of Object.entries(o.prefs)) { if (n >= 80) break; if (KEY.test(k) && !SKIP.has(k) && typeof v === 'string' && v.length <= 20000) { prefs[k] = v; n++; } }
  return { workouts, routes, prefs };
}

/** Adds what is missing (workouts by start time, routes by id; never more than the store keeps) and restores the settings. Returns what was really kept. */
export async function applyBackup(parsed) {
  const haveW = new Set((await listWorkouts({ points: false })).map((w) => w.startedAt)), haveR = new Set((await listRoutes()).map((r) => r.id));
  let workouts = 0, routes = 0, room = Math.max(0, MAX_WORKOUTS - haveW.size);
  for (const r of parsed.routes) if (!haveR.has(r.id) && await saveRoute(r)) routes++;
  for (const w of [...parsed.workouts].sort((a, b) => b.startedAt - a.startedAt)) { // newest first: when the store is nearly full, the newest missing ones are kept
    if (haveW.has(w.startedAt) || room <= 0) continue;
    if (!(await saveWorkout(w))) continue;
    if (w.weather || w.routeId) await updateWorkout(w.startedAt, { weather: w.weather, routeId: w.routeId }); // saveWorkout keeps only the summary fields
    workouts++; room--;
  }
  for (const [k, v] of Object.entries(parsed.prefs)) setPref(k, v);
  return { workouts, routes, prefs: Object.keys(parsed.prefs).length };
}
