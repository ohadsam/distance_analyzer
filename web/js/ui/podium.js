// A broken record gets a celebration: the person can take a victory photo and see themselves on a podium with a gold medal (animated, calm with reduced motion),
// then share or save the card as a picture. The photo stays in memory only.
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { native } from '../native.js';
import { fmtKm, fmtPaceUnit, fmtClock, fmtDate } from '../format.js';
import { renderCard, squarePhoto, seeded } from '../podiumCard.js';

const isDark = () => { const th = document.documentElement.dataset.theme; return th === 'dark' || (th !== 'light' && !!matchMedia?.('(prefers-color-scheme: dark)').matches); };
const TITLE = { distance: 'rcdDistance', pace: 'rcdPace', km: 'rcdKm' };
const valueText = (r) => (r.id === 'distance' ? fmtKm(r.value) : r.id === 'pace' ? fmtPaceUnit(r.value) : fmtClock(r.value));
const prevText = (r) => t('rcdBefore', { v: r.id === 'distance' ? fmtKm(r.prev) : r.id === 'pace' ? fmtPaceUnit(r.prev) : fmtClock(r.prev) });

/** The animated podium scene (pure DOM + CSS: transform and opacity only). */
export function podiumScene(photo, rec) {
  const rnd = seeded(7), confetti = Array.from({ length: 24 }, (_, i) => h('i', { class: `pd-c c${i % 5}`, style: { left: `${Math.round(rnd() * 100)}%`, '--d': `${(rnd() * 2).toFixed(2)}s`, '--r': `${Math.round(rnd() * 360)}deg` } }));
  return h('div', { class: 'podium', role: 'img', 'aria-label': `${t(TITLE[rec.id])}: ${valueText(rec)}` },
    ...confetti,
    h('div', { class: 'pd-title' }, h('b', null, t(TITLE[rec.id])), h('span', null, valueText(rec))),
    h('div', { class: 'pd-step s2' }, '2'), h('div', { class: 'pd-step s3' }, '3'), h('div', { class: 'pd-step s1' }, '1'),
    h('div', { class: 'pd-photo' }, photo ? h('img', { src: photo, alt: '' }) : null), h('div', { class: 'pd-ribbon' }), h('div', { class: 'pd-medal' }, '★'));
}

/** records: [{ id, value, prev }] (best first); w: the finished workout. */
export function celebrationCard(records, w) {
  const rec = records[0], box = h('div', { class: 'card celebrate', id: 'celebrate' }); let photoUrl = '', photoCv = null;
  const msg = h('p', { class: 'note', role: 'status', id: 'rec-msg' });
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'user', hidden: true, id: 'rec-file', 'aria-label': t('rcdTake'), onchange: async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await got(f); } });
  async function got(src) { try { photoCv = await squarePhoto(src); photoUrl = photoCv.toDataURL('image/jpeg', 0.85); scene(); } catch { setChildren(msg, t('rcdPhotoError')); } }
  async function take() {
    if (!native.available) return file.click();
    const r = await native.takePhoto(); if (r?.ok) await got(native.takenPhoto()); else setChildren(msg, t('rcdPhotoCancel'));
  }
  function card() { return renderCard({ photo: photoCv, title: t(TITLE[rec.id]), value: valueText(rec), sub: `${fmtDate(w.startedAt, getLang())} · ${prevText(rec)}`, dark: isDark(), rtl: getLang() === 'he' }); }
  async function share() {
    try {
      const cv = card(); // encoded once: base64 for Android's share sheet, a blob for the browser
      if (native.available) { const b64 = cv.toDataURL('image/png').split(',')[1]; return setChildren(msg, b64 && native.shareImage(b64) ? '' : t('rcdShareError')); }
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png')); if (!blob) return setChildren(msg, t('rcdShareError'));
      const f = new File([blob], 'stepup-record.png', { type: 'image/png' });
      try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: 'StepUp' }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
      const a = h('a', { href: URL.createObjectURL(blob), download: 'stepup-record.png' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch { setChildren(msg, t('rcdShareError')); }
  }
  function ask() {
    setChildren(box, h('h2', null, t(TITLE[rec.id])), h('p', { class: 'big' }, valueText(rec)), h('p', { class: 'note' }, prevText(rec)), records.length > 1 ? h('p', { class: 'note' }, records.slice(1).map((r) => `${t(TITLE[r.id])}: ${valueText(r)}`).join(' · ')) : null,
      h('p', null, t('rcdAsk')), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', id: 'rec-photo', onclick: take }, t('rcdTake')), h('button', { type: 'button', class: 'btn ghost', id: 'rec-nophoto', onclick: () => { photoUrl = ''; photoCv = null; scene(); } }, t('rcdNoPhoto'))), file, msg);
  }
  function scene() {
    setChildren(box, podiumScene(photoUrl, rec), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', id: 'rec-share', onclick: share }, t('rcdShare')), h('button', { type: 'button', class: 'btn ghost', id: 'rec-retake', onclick: ask }, t('rcdAgain'))), file, msg);
  }
  ask(); return box;
}
