// Persistence: finished workouts in IndexedDB (memory fallback when storage is blocked), the in-progress workout and preferences in localStorage.
// Everything read back is sanitised; the list is bounded.
import { sanitizeWorkout, sanitizeActive, summarize } from './workout.js';

export const MAX_WORKOUTS = 1000;
const DB = 'distance-analyzer', STORE = 'workouts';
let mem = [], dbp = null;

function open() {
  dbp ||= new Promise((res) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE, { keyPath: 'startedAt' });
      rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
const wrap = (rq) => new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });

export async function listWorkouts() {
  const db = await open(); let rows = mem;
  if (db) try { rows = await wrap(db.transaction(STORE).objectStore(STORE).getAll()); } catch { /* fall back to memory */ }
  return rows.map(sanitizeWorkout).filter(Boolean).sort((a, b) => b.startedAt - a.startedAt);
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
export async function deleteWorkout(startedAt) {
  mem = mem.filter((r) => r.startedAt !== startedAt); const db = await open();
  if (db) try { await wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(startedAt)); } catch { /* ignore */ }
}

// In-progress workout (survives a reload or the app being killed): small JSON in localStorage.
export const active = {
  load() { try { const r = JSON.parse(localStorage.getItem('da.active') || 'null'); return r ? sanitizeActive(r) : null; } catch { return null; } },
  save(w) { try { localStorage.setItem('da.active', JSON.stringify(w)); } catch { /* storage full or blocked */ } },
  clear() { try { localStorage.removeItem('da.active'); } catch { /* ignore */ } },
};

// Preferences (strings in localStorage, with a memory fallback) and typed helpers.
const prefs = new Map();
export const getPref = (k, d) => { try { return localStorage.getItem(`da.${k}`) ?? d; } catch { return prefs.get(k) ?? d; } };
export const setPref = (k, v) => { prefs.set(k, String(v)); try { localStorage.setItem(`da.${k}`, String(v)); } catch { /* memory only */ } };
export const getNum = (k, d, lo, hi) => { const n = Number(getPref(k, d)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
