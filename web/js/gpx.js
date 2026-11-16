// A workout as a GPX 1.1 file (the common exchange format: Strava, Garmin Connect, Komoot ... read it). Pure.
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const MAX_POINTS = 50000;
const ok = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;

/** w: { kind, startedAt, points: [[lat, lon, t(ms)]] }. Returns the file text, or '' when there is no usable track. */
export function toGpx(w, name = '') {
  const good = (w?.points || []).filter(ok); if (good.length < 2) return '';
  const step = Math.max(1, Math.ceil(good.length / MAX_POINTS)), pts = good.filter((_, i) => i % step === 0 || i === good.length - 1); // a very long track is thinned evenly (start and end kept), never cut off
  const title = esc(name || `StepUp ${w.kind === 'run' ? 'run' : 'walk'}`);
  const seg = pts.map((p) => `<trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}">${Number.isFinite(p[2]) && p[2] > 0 ? `<time>${new Date(p[2]).toISOString()}</time>` : ''}</trkpt>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="StepUp" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${title}</name>${Number.isFinite(w.startedAt) ? `<time>${new Date(w.startedAt).toISOString()}</time>` : ''}</metadata><trk><name>${title}</name><type>${w.kind === 'run' ? 'running' : 'walking'}</type><trkseg>${seg}</trkseg></trk></gpx>\n`;
}
/** A safe file name: stepup-run-2026-11-15.gpx */
export const gpxFileName = (w) => { const d = new Date(w.startedAt); return `stepup-${w.kind === 'run' ? 'run' : 'walk'}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.gpx`; }; // the local date, as the app shows it
