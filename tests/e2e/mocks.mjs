// Stand-ins for the route planner's four online services (Nominatim, FOSSGIS OSRM, Open-Meteo elevation, Overpass), shared by smoke.mjs and journey.mjs.
// OSRM answers with a gentle wiggle through the requested points; elevation is a hill; Overpass returns a sidewalk along the whole route plus one crossing.
export const PLACES = { herzl: { display_name: 'Herzl 1, Tel Aviv-Yafo', lat: '32.0610', lon: '34.7700' }, dizengoff: { display_name: 'Dizengoff 50, Tel Aviv-Yafo', lat: '32.0780', lon: '34.7740' } };
export async function mockPlanner(page, { fail = false } = {}) {
  const calls = { nominatim: 0, osrm: 0, elevation: 0, overpass: 0 };
  await page.route('https://nominatim.openstreetmap.org/**', (r) => { calls.nominatim++; const q = new URL(r.request().url()).searchParams.get('q') || ''; const hit = /dizengoff/i.test(q) ? PLACES.dizengoff : /herzl|הרצל/i.test(q) ? PLACES.herzl : null; return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(hit ? [hit] : []) }); });
  await page.route('https://routing.openstreetmap.de/**', (r) => {
    calls.osrm++; if (fail) return r.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: 'x' });
    const pts = decodeURIComponent(new URL(r.request().url()).pathname.split('/').pop()).split(';').map((p) => p.split(',').map(Number)); // [lon, lat]
    const out = []; for (let i = 1; i < pts.length; i++) for (let k = 0; k < 12; k++) { const f = k / 12, a = pts[i - 1], b = pts[i]; out.push([a[0] + (b[0] - a[0]) * f + Math.sin(k) * 0.0002, a[1] + (b[1] - a[1]) * f + Math.cos(k) * 0.0002]); }
    out.push(pts[pts.length - 1]); let m = 0; for (let i = 1; i < out.length; i++) m += Math.hypot((out[i][0] - out[i - 1][0]) * 94000, (out[i][1] - out[i - 1][1]) * 111000);
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'Ok', routes: [{ distance: m * 1.25, geometry: { type: 'LineString', coordinates: out } }] }) });
  });
  await page.route('https://api.open-meteo.com/v1/elevation**', (r) => { calls.elevation++; const n = (new URL(r.request().url()).searchParams.get('latitude') || '').split(',').length; return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => Math.round(20 + 18 * Math.sin(i / 7))) }) }); });
  await page.route('https://overpass-api.de/**', (r) => {
    calls.overpass++; const q = decodeURIComponent((r.request().postData() || '').replace(/^data=/, '')); const m = /around:18,([-\d.,]+)\)/.exec(q); const n = (m ? m[1] : '').split(',').map(Number), pts = []; for (let i = 0; i + 1 < n.length; i += 2) pts.push({ lat: n[i], lon: n[i + 1] });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ elements: [{ type: 'way', tags: { highway: 'residential', sidewalk: 'both' }, geometry: pts }, ...(pts[3] ? [{ type: 'node', lat: pts[3].lat, lon: pts[3].lon, tags: { highway: 'crossing', crossing: 'traffic_signals' } }] : [])] }) });
  });
  return calls;
}
