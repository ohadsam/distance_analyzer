// Updates and sharing. The only network call here is the "Check for updates" button (one GET to GitHub's public release list, nothing is sent about the person).
export const REPO = 'ohadsam/distance_analyzer';
export const APK_URL = `https://github.com/${REPO}/releases/latest/download/stepup.apk`;
export const SITE_URL = 'https://ohadsam.github.io/distance_analyzer/';
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;

/** -1, 0 or 1 for "x.y.z" strings (anything else compares as 0.0.0). */
export function cmpVersion(a, b) {
  const p = (v) => (/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(v) ? v.split('.').map(Number) : [0, 0, 0]), x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** The release JSON from GitHub (untrusted) -> { version, notes } or null. The title looks like "v0.9.1 (build 34)". */
export function parseRelease(j) {
  const m = j && typeof j.name === 'string' ? /\bv?(\d{1,5}\.\d{1,5}\.\d{1,5})\b/.exec(j.name) : null; if (!m) return null;
  return { version: m[1], notes: typeof j.body === 'string' ? j.body.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 500) : '' };
}

/** { state: 'latest' | 'newer' | 'error', version?, notes? } - never throws. */
export async function checkUpdate(current, doFetch = globalThis.fetch) {
  try {
    const r = await doFetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!r.ok) return { state: 'error' };
    const rel = parseRelease(await r.json()); if (!rel) return { state: 'error' };
    return cmpVersion(current, rel.version) < 0 ? { state: 'newer', ...rel } : { state: 'latest', version: rel.version };
  } catch { return { state: 'error' }; }
}

/** Shares the app link: Android's own share sheet, the browser's share sheet, else copies it. Returns 'shared' | 'copied' | 'manual'. */
export async function shareApp(text, { native, nav = globalThis.navigator } = {}) {
  if (native?.available && native.share(text)) return 'shared';
  try { if (nav?.share) { await nav.share({ title: 'StepUp', text }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'shared'; }
  try { await nav.clipboard.writeText(`${text}`); return 'copied'; } catch { return 'manual'; }
}
