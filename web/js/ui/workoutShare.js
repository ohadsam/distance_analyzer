// "Share a picture" and "Export GPX" for one finished workout (the summary and the history detail).
import { h, setChildren } from '../util.js';
import { t, getLang } from '../i18n.js';
import { native } from '../native.js';
import { fmtKm, fmtClock, fmtPaceUnit, fmtDate } from '../format.js';
import { avgPaceSec } from '../workout.js';
import { renderWorkoutCard } from '../podiumCard.js';
import { shareCanvas } from '../shareCard.js';
import { isDark } from '../art.js';
import { toGpx, gpxFileName } from '../gpx.js';

export function workoutShareBox(w) {
  const msg = h('p', { class: 'note', role: 'status' }), say = (k) => setChildren(msg, k ? t(k) : '');
  async function picture() {
    say('bkWorking');
    const card = await renderWorkoutCard({ title: `${t(w.kind)} · ${fmtDate(w.startedAt, getLang())}`, points: w.points || [], dark: isDark(), rtl: getLang() === 'he', style: w.kind === 'run' ? 'sunrise' : 'forest',
      stats: [{ value: fmtKm(w.distanceM), label: t('distance') }, { value: fmtClock(w.elapsedMs || w.movingMs), label: t('time') }, { value: fmtPaceUnit(avgPaceSec(w)), label: t('avgPace') }] });
    say(await shareCanvas(card, `stepup-${w.kind}.png`));
  }
  async function gpx() {
    const text = toGpx(w, `${t(w.kind)} ${fmtDate(w.startedAt, getLang())}`), name = gpxFileName(w); if (!text) return say('gpxNone');
    if (native.available) { const r = await native.saveGpx(text, name); return say(r?.ok ? 'gpxSaved' : r?.refused ? 'bkError' : 'bkCancelled'); }
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/gpx+xml' })), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000); say('gpxSaved');
  }
  return h('div', { class: 'wk-share' }, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn ghost', id: 'share-workout', onclick: picture }, t('shareWorkout')), (w.points || []).length >= 2 ? h('button', { type: 'button', class: 'btn ghost', id: 'export-gpx', onclick: gpx }, t('exportGpx')) : null), msg);
}
