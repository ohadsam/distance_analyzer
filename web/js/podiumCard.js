// The shareable record card as a PNG (canvas, 1080 x 1350): the person's photo on the top step of a podium with a gold medal, the result and the app name.
// The photo and the card are never stored or uploaded by the app; they exist in memory until the person shares or saves them.
const W = 1080, H = 1350;
const PALETTE = { light: { bg1: '#F5F8FA', bg2: '#DDEFEA', text: '#17232D', muted: '#526474', primary: '#006B60', gold: '#E0A800', silver: '#B8C2CC', bronze: '#C07A4A', confetti: ['#006B60', '#216B39', '#A13F20', '#145AA0', '#E0A800'] },
  dark: { bg1: '#111820', bg2: '#16363D', text: '#F5F8FA', muted: '#B8C6D2', primary: '#9CE5D6', gold: '#F2C230', silver: '#8FA0B0', bronze: '#D49B73', confetti: ['#9CE5D6', '#9BE3B1', '#FFC4A6', '#A9D4FF', '#F2C230'] } };

/** Deterministic pseudo-random numbers (the on-screen scene and the PNG scatter the confetti the same way). */
export function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function fit(ctx, text, maxW, size, weight = 700) { let s = size; do { ctx.font = `${weight} ${s}px system-ui, "Segoe UI", Roboto, "Noto Sans", sans-serif`; s -= 4; } while (ctx.measureText(text).width > maxW && s > 24); }

/**
 * opts: { photo: CanvasImageSource | null, title, value, sub, brand, dark, rtl }. Returns the canvas (call toBlob on it).
 */
export function renderCard({ photo = null, title, value, sub = '', brand = 'StepUp', dark = false, rtl = false } = {}, canvas = document.createElement('canvas')) {
  const c = PALETTE[dark ? 'dark' : 'light']; canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'); ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = 'center';
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c.bg1); g.addColorStop(1, c.bg2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rnd = seeded(7); // confetti
  for (let i = 0; i < 46; i++) { ctx.save(); ctx.translate(rnd() * W, rnd() * 760); ctx.rotate(rnd() * 3); ctx.fillStyle = c.confetti[i % 5]; ctx.globalAlpha = 0.85; ctx.fillRect(-9, -5, 18, 10); ctx.restore(); }
  ctx.fillStyle = c.text; fit(ctx, title, 960, 92); ctx.fillText(title, W / 2, 150);
  ctx.fillStyle = c.primary; fit(ctx, value, 960, 132); ctx.fillText(value, W / 2, 290);
  if (sub) { ctx.fillStyle = c.muted; fit(ctx, sub, 960, 46, 500); ctx.fillText(sub, W / 2, 360); }
  // podium: silver (left), gold (centre, highest), bronze (right)
  const step = (x, top, w, color, label) => { ctx.fillStyle = color; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, top, w, 1300 - top, [18, 18, 0, 0]); else ctx.rect(x, top, w, 1300 - top); ctx.fill(); ctx.fillStyle = dark ? '#111820' : '#FFFFFF'; const room = 1300 - top; ctx.font = `700 ${Math.min(84, room - 20)}px system-ui, sans-serif`; ctx.fillText(label, x + w / 2, top + Math.min(100, room - 14)); };
  step(90, 1190, 300, c.silver, '2'); step(690, 1230, 300, c.bronze, '3'); step(390, 1120, 300, c.gold, '1');
  // the person: photo in a gold ring (a calm round badge when there is no photo)
  ctx.save(); ctx.beginPath(); ctx.arc(W / 2, 800, 180, 0, Math.PI * 2); ctx.clip();
  if (photo) { const s = Math.min(photo.width, photo.height); ctx.drawImage(photo, (photo.width - s) / 2, (photo.height - s) / 2, s, s, W / 2 - 180, 620, 360, 360); } else { ctx.fillStyle = c.primary; ctx.fillRect(W / 2 - 180, 620, 360, 360); }
  ctx.restore(); ctx.lineWidth = 18; ctx.strokeStyle = c.gold; ctx.beginPath(); ctx.arc(W / 2, 800, 189, 0, Math.PI * 2); ctx.stroke();
  // medal on a ribbon
  ctx.fillStyle = c.primary; ctx.beginPath(); ctx.moveTo(W / 2 - 70, 960); ctx.lineTo(W / 2, 1050); ctx.lineTo(W / 2 + 70, 960); ctx.lineTo(W / 2 + 40, 960); ctx.lineTo(W / 2, 1010); ctx.lineTo(W / 2 - 40, 960); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(W / 2, 1065, 52, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = dark ? '#111820' : '#FFFFFF'; ctx.stroke();
  ctx.fillStyle = dark ? '#111820' : '#FFFFFF'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 26, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(W / 2 + Math.cos(a) * r, 1065 + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.muted; ctx.font = '600 40px system-ui, sans-serif'; ctx.fillText(brand, W / 2, 1335);
  return canvas;
}

/** A square, centre-cropped, downscaled copy of a photo (File/Blob or data URL) - phone photos are huge and the card needs 360 px. (createImageBitmap: a blob: URL would be refused by the page's CSP.) */
export async function squarePhoto(src, size = 640) {
  const img = typeof src === 'string' ? await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }) : await createImageBitmap(src);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, s = Math.min(w, h), cv = document.createElement('canvas'); cv.width = cv.height = size;
  cv.getContext('2d').drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size); img.close?.();
  return cv;
}
