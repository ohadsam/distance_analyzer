// Persistence: finished workouts in IndexedDB (memory fallback when storage is blocked), the in-progress workout and preferences in localStorage.
// Everything read back is sanitised; the list is bounded.
import { sanitizeWorkout, sanitizeActive, summarize } from './workout.js';
import { sanitizeRoute, MAX_ROUTES } from './route.js';

export const MAX_WORKOUTS = 1000;
const DB = 'stepup', STORE = 'workouts';
let mem = [], memRoutes = [], dbp = null;

function open() {
  dbp ||= new Promise((res) => {
    try {
      const rq = indexedDB.open(DB, 2);
      rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'startedAt' }); if (!db.objectStoreNames.contains('routes')) db.createObjectStore('routes', { keyPath: 'id' }); };
      rq.onsuccess = () => { const db = rq.result; db.onversionchange = () => { db.close(); dbp = null; }; res(db); }; // let a newer version upgrade; reopen on the next use
      rq.onerror = () => { res(null); dbp = null; }; rq.onblocked = () => { res(null); dbp = null; }; // an old tab holds the old version: this call uses memory, the next one tries again
    } catch { res(null); }
  });
  return dbp;
}
const wrap = (rq) => new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });

/** Newest first. `points: false` skips the (large) route points: statistics, search and reminders never need them. */
export async function listWorkouts({ points = true } = {}) {
  const db = await open(); let rows = mem;
  if (db) try { rows = await wrap(db.transaction(STORE).objectStore(STORE).getAll()); } catch { /* fall back to memory */ }
  return rows.map((r) => sanitizeWorkout(points ? r : { ...r, points: [] })).filter(Boolean).sort((a, b) => b.startedAt - a.startedAt);
}
export async function saveWorkout(w) {
  const rec = sanitizeWorkout(summarize(w)); if (!rec) return null;
  mem = [rec, ...mem.filter((r) => r.startedAt !== rec.startedAt)].slice(0, MAX_WORKOUTS);
  const db = await open();
  if (db) try {
    const os = db.transaction(STORE, 'readwrite').objectStore(STORE); await wrap(os.put(rec));
    const keys = await wrap(os.getAllKeys()); for (const k of keys.sort((a, b) => a - b).slice(0, Math.max(0, keys.length - MAX_WORKOUTS))) os.delete(k);
  } catch { /* memory copy remains */ }
  return rec;
}
/** One workout by its key (with its points), or null. */
export async function getWorkout(startedAt) {
  const db = await open(); let r = mem.find((x) => x.startedAt === startedAt);
  if (db) try { r = (await wrap(db.transaction(STORE).objectStore(STORE).get(startedAt))) ?? r; } catch { /* memory */ }
  return r ? sanitizeWorkout(r) : null;
}
/** Adds the weather, route link or other safe fields to ONE saved workout (reads and writes only that record). */
export async function updateWorkout(startedAt, patch) {
  const r = await getWorkout(startedAt); if (!r) return null;
  const rec = sanitizeWorkout({ ...r, ...patch }); if (!rec) return null;
  mem = [rec, ...mem.filter((x) => x.startedAt !== startedAt)]; const db = await open();
  if (db) try { await wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec)); } catch { /* memory copy remains */ }
  return rec;
}
export async function deleteWorkout(startedAt) {
  mem = mem.filter((r) => r.startedAt !== startedAt); const db = await open();
  if (db) try { await wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(startedAt)); } catch { /* ignore */ }
}

// Saved routes (a few KB each, at most MAX_ROUTES).
export async function listRoutes() {
  const db = await open(); let rows = memRoutes;
  if (db) try { rows = await wrap(db.transaction('routes').objectStore('routes').getAll()); } catch { /* memory */ }
  return rows.map(sanitizeRoute).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
}
export async function saveRoute(r) {
  const rec = sanitizeRoute(r); if (!rec) return null;
  memRoutes = [rec, ...memRoutes.filter((x) => x.id !== rec.id)].slice(0, MAX_ROUTES); const db = await open();
  if (db) try { await wrap(db.transaction('routes', 'readwrite').objectStore('routes').put(rec)); } catch { /* memory copy remains */ }
  return rec;
}
export async function deleteRoute(id) {
  memRoutes = memRoutes.filter((x) => x.id !== id); const db = await open();
  if (db) try { await wrap(db.transaction('routes', 'readwrite').objectStore('routes').delete(id)); } catch { /* ignore */ }
  for (const w of await listWorkouts({ points: false })) if (w.routeId === id) await updateWorkout(w.startedAt, { routeId: '' }); // the workouts stay, just unlinked
}

// In-progress workout (survives a reload or the app being killed): small JSON in localStorage.
export const active = {
  load() { try { const r = JSON.parse(localStorage.getItem('da.active') || 'null'); return r ? sanitizeActive(r) : null; } catch { return null; } },
  save(w) {
    try { localStorage.setItem('da.active', JSON.stringify(w)); } catch { try { localStorage.setItem('da.active', JSON.stringify({ ...w, points: w.points.slice(-1500) })); } catch { /* storage full or blocked */ } } // quota: keep the numbers, drop old route points
  },
  clear() { try { localStorage.removeItem('da.active'); } catch { /* ignore */ } },
};

// Preferences (strings in localStorage, with a memory fallback) and typed helpers.
const prefs = new Map();
export const getPref = (k, d) => { try { return localStorage.getItem(`da.${k}`) ?? d; } catch { return prefs.get(k) ?? d; } };
export const setPref = (k, v) => { prefs.set(k, String(v)); try { localStorage.setItem(`da.${k}`, String(v)); } catch { /* memory only */ } };
export const getNum = (k, d, lo, hi) => { const n = Number(getPref(k, d)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** The person: age, height, weight (clamped). */
export const profile = () => ({ age: getNum('age', 35, 5, 100), heightCm: getNum('height', 170, 100, 230), weightKg: getNum('weight', 70, 30, 250) });

// Small JSON preferences (validated by the caller): dashboard layout, reminders, smart nudges, one-week bar override.
export const getJson = (k, d) => { try { return JSON.parse(getPref(k, '')) ?? d; } catch { return d; } };
export const setJson = (k, v) => setPref(k, JSON.stringify(v));
