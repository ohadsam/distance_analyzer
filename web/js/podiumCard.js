// The shareable record card as a PNG (canvas, 1080 x 1350): the design kit's card background and podium layers, the person's photo in the avatar frame, the result in words.
// The photo and the card are never uploaded by the app. They live in memory; on Android the card is written to the app's cache only while the share sheet needs it and removed at the next start.
const W = 1080, H = 1350, ART = 'art/celebrate';
const TEXT = { light: { text: '#17232D', primary: '#006B60', muted: '#526474' }, dark: { text: '#F5F8FA', primary: '#9CE5D6', muted: '#B8C6D2' } };
export const CARD_STYLES = ['sunrise', 'forest', 'ocean'];
/** Scene layout in the kit's 360 x 450 coordinates: the photo circle (centre 180,114, diameter 136.8) and the layers that stack around it. */
export const SCENE = { w: 360, h: 450, photo: { cx: 180, cy: 114, d: 136.8 }, rays: { x: 0, y: -66, s: 360 }, trophy: { x: 132, y: 184, s: 96 } };
export const CONFETTI = ['rectangle', 'circle', 'triangle', 'curl', 'star'];

/** Deterministic pseudo-random numbers (the on-screen scene and the PNG scatter the confetti the same way). */
export function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const loaded = new Map();
/** A kit picture as an image element (cached; rejects when it cannot load). */
export function loadArt(name, mode, size, dir = ART) {
  const key = `${name}-${mode}`, id = `${dir}/${key}`; if (loaded.has(id)) return loaded.get(id);
  const p = new Promise((res, rej) => { const i = new Image(); if (size) { i.width = size[0]; i.height = size[1]; } i.onload = () => res(i); i.onerror = () => rej(new Error(key)); i.src = `${dir}/${key}.svg`; });
  loaded.set(id, p); p.catch(() => loaded.delete(id)); return p;
}

function fit(ctx, text, maxW, size, weight = 700) { let s = size; do { ctx.font = `${weight} ${s}px system-ui, "Segoe UI", Roboto, "Noto Sans", sans-serif`; s -= 4; } while (ctx.measureText(text).width > maxW && s > 24); }

/**
 * opts: { photo: CanvasImageSource | null, title, value, sub, brand, dark, rtl, style, trophy }.
 * Resolves to the canvas (call toBlob / toDataURL on it). Missing pictures are skipped, never fatal.
 */
export async function renderCard({ photo = null, title, value, sub = '', brand = 'StepUp', dark = false, rtl = false, style = 'sunrise', trophy = false } = {}, canvas = document.createElement('canvas')) {
  const mode = dark ? 'dark' : 'light', c = TEXT[mode]; canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'); ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = 'center';
  const k = 864 / SCENE.w, ox = (W - 864) / 2, oy = H - SCENE.h * k; // the 360 x 450 scene fills the lower part of the card
  const put = async (name, x, y, w, h) => { try { ctx.drawImage(await loadArt(name, mode, [Math.round(w), Math.round(h)]), x, y, w, h); } catch { /* a missing picture is skipped */ } };
  await put(style, 0, 0, W, H);
  await put('rays', ox + SCENE.rays.x * k, oy + SCENE.rays.y * k, SCENE.rays.s * k, SCENE.rays.s * k);
  const rnd = seeded(7); // confetti behind the podium, below the text, scattered like the on-screen scene
  for (let i = 0; i < 24; i++) await put(`confetti-${CONFETTI[i % 5]}`, rnd() * (W - 40), 390 + rnd() * 600, 36, 36);
  await put('podium-floor', ox, oy, SCENE.w * k, SCENE.h * k); await put('podium-steps', ox, oy, SCENE.w * k, SCENE.h * k); await put('laurel', ox, oy, SCENE.w * k, SCENE.h * k);
  const p = SCENE.photo, cx = ox + p.cx * k, cy = oy + p.cy * k, r = p.d / 2 * k;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (photo) { const s = Math.min(photo.width, photo.height); ctx.drawImage(photo, (photo.width - s) / 2, (photo.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2); } else { ctx.fillStyle = c.primary; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
  ctx.restore();
  await put('avatar-frame', ox, oy, SCENE.w * k, SCENE.h * k);
  if (trophy) await put('trophy', ox + SCENE.trophy.x * k, oy + SCENE.trophy.y * k, SCENE.trophy.s * k, SCENE.trophy.s * k);
  else { await put('ribbon', ox, oy, SCENE.w * k, SCENE.h * k); await put('medal', ox, oy, SCENE.w * k, SCENE.h * k); }
  ctx.fillStyle = c.text; fit(ctx, title, 960, 92); ctx.fillText(title, W / 2, 150);
  ctx.fillStyle = c.primary; fit(ctx, value, 960, 132); ctx.fillText(value, W / 2, 290);
  if (sub) { ctx.fillStyle = c.muted; fit(ctx, sub, 960, 46, 500); ctx.fillText(sub, W / 2, 360); }
  ctx.fillStyle = c.muted; ctx.font = '600 40px system-ui, sans-serif'; ctx.fillText(brand, W / 2, 1335);
  return canvas;
}

/**
 * The picture of a finished workout (1080 x 1350): title, the route drawn on the kit's card background, and three numbers.
 * opts: { title, sub, points: [[lat, lon]], stats: [{ value, label }], dark, rtl, style, brand }.
 */
export async function renderWorkoutCard({ title, sub = '', points = [], stats = [], dark = false, rtl = false, style = 'forest', brand = 'StepUp' } = {}, canvas = document.createElement('canvas')) {
  const mode = dark ? 'dark' : 'light', c = TEXT[mode]; canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'); ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = 'center';
  // the workout kit's cards: a quiet plate (x160 y344, 760 x 560) for the route
  try { ctx.drawImage(await loadArt(`card-${style}`, mode, [W, H], 'art/workout'), 0, 0, W, H); } catch { ctx.fillStyle = dark ? '#111820' : '#F5F8FA'; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = c.text; fit(ctx, title, 960, 92); ctx.fillText(title, W / 2, 150);
  if (sub) { ctx.fillStyle = c.muted; fit(ctx, sub, 960, 46, 500); ctx.fillText(sub, W / 2, 225); }
  // the route, fitted into a box (equirectangular, aspect kept)
  const pts = points.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])), step = Math.max(1, Math.ceil(pts.length / 400)), use = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  if (use.length > 1) {
    const lat0 = use.reduce((s, p) => s + p[0], 0) / use.length * Math.PI / 180, kx = Math.cos(lat0), xs = use.map((p) => p[1] * kx), ys = use.map((p) => -p[0]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), span = Math.max(maxX - minX, maxY - minY, 1e-9), bw = 720, bh = 520, scale = Math.min(bw, bh) / span;
    const ox = (W - (maxX - minX) * scale) / 2, oy = 364 + (bh - (maxY - minY) * scale) / 2, xy = use.map((p, i) => [ox + (xs[i] - minX) * scale, oy + (ys[i] - minY) * scale]);
    ctx.lineJoin = ctx.lineCap = 'round'; ctx.lineWidth = 18; ctx.strokeStyle = dark ? '#111820' : '#FFFFFF'; ctx.beginPath(); xy.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); // a light outline keeps the line readable on the hills
    ctx.lineWidth = 10; ctx.strokeStyle = c.primary; ctx.beginPath(); xy.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    for (const [p, col] of [[xy[0], '#145AA0'], [xy[xy.length - 1], '#A13F20']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], 20, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = dark ? '#111820' : '#FFFFFF'; ctx.stroke(); }
  }
  const n = Math.max(1, Math.min(3, stats.length)), colW = 920 / n;
  stats.slice(0, 3).forEach((s, i) => { const x = 80 + colW * (i + 0.5); ctx.fillStyle = c.primary; fit(ctx, s.value, colW - 20, 84); ctx.fillText(s.value, x, 1150); ctx.fillStyle = c.muted; fit(ctx, s.label, colW - 20, 36, 500); ctx.fillText(s.label, x, 1200); });
  ctx.fillStyle = c.muted; ctx.font = '600 40px system-ui, sans-serif'; ctx.fillText(brand, W / 2, 1320);
  return canvas;
}

/** A square, centre-cropped, downscaled copy of a photo (File/Blob or data URL) - phone photos are huge and the card needs 360 px. (createImageBitmap: a blob: URL would be refused by the page's CSP.) */
export async function squarePhoto(src, size = 640) {
  const img = typeof src === 'string' ? await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }) : await createImageBitmap(src);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, s = Math.min(w, h), cv = document.createElement('canvas'); cv.width = cv.height = size;
  cv.getContext('2d').drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size); img.close?.();
  return cv;
}
