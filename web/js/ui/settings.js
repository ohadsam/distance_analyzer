import { h, setChildren } from '../util.js';
import { refreshArt } from '../art.js';
import { t, setLang } from '../i18n.js';
import { getPref, setPref, getNum, getJson, setJson } from '../store.js';
import { aboutBlock } from './about.js';
import { backupBlock } from './backup.js';
import { native } from '../native.js';
import { sanitizeReminders, sanitizeSmart, MAX_REMINDERS } from '../reminders.js';
import { notifyState, askNotify } from './notify.js';
import { checkReminders } from '../reminderLoop.js';
import { onlineOn, getLoc, setLoc, locate, forgetWeather } from '../weatherApi.js';
import { syncNative } from '../syncNative.js';

const PACKS = [['momentum', 'packMomentum'], ['ocean', 'packOcean'], ['forest', 'packForest'], ['sunset', 'packSunset'], ['violet', 'packViolet'], ['slate', 'packSlate'], ['mono', 'packMono'], ['high-contrast', 'packHigh']];
const opt = (value, label, cur) => h('option', { value, selected: value === cur }, label);
const field = (label, control, id) => h('div', { class: 'field', id: `f-${id}` }, h('label', { for: id }, label), control);
const select = (id, value, items, onchange) => h('select', { id, onchange: (e) => onchange(e.target.value) }, items.map(([v, l]) => opt(v, l, value)));
const check = (id, label, on, onchange) => h('label', { class: 'check', id: `f-${id}` }, h('input', { type: 'checkbox', id, checked: on, onchange: (e) => onchange(e.target.checked) }), h('span', null, label));

export function applyLook() {
  const root = document.documentElement, rawTheme = getPref('theme', 'auto'), rawPack = getPref('pack', 'momentum'), theme = ['light', 'dark'].includes(rawTheme) ? rawTheme : 'auto', pack = PACKS.some(([v]) => v === rawPack) ? rawPack : 'momentum'; // storage is untrusted: only known values reach the DOM
  if (theme === 'auto') delete root.dataset.theme; else root.dataset.theme = theme;
  if (pack === 'momentum') delete root.dataset.pack; else root.dataset.pack = pack;
  refreshArt();
  const bg = getComputedStyle(root).getPropertyValue('--background').trim(); if (bg) document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg);
}

const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DAYS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function remindersBlock() {
  const box = h('div', { class: 'rems' });
  const draw = () => {
    const list = sanitizeReminders(getJson('rems', [])), save = (l) => { setJson('rems', l); syncNative(); draw(); };
    const lang = document.documentElement.lang, names = lang === 'he' ? DAYS_HE : DAYS_EN;
    setChildren(box, list.length ? list.map((r, i) => h('div', { class: 'rem', 'data-rem': r.id },
      h('div', { class: 'rem-top' }, select(`rk${i}`, r.kind, [['walk', t('remWalk')], ['move', t('remMove')]], (v) => { list[i].kind = v; save(list); }),
        h('input', { type: 'time', 'aria-label': t('remTime'), value: r.time, onchange: (e) => { if (e.target.value) { list[i].time = e.target.value; save(list); } } }),
        h('button', { type: 'button', class: 'round sm', 'aria-label': t('remDelete'), onclick: () => save(list.filter((_, j) => j !== i)) }, '✕')),
      h('div', { class: 'days', role: 'group', 'aria-label': t('remDays') }, names.map((n, d) => h('button', { type: 'button', class: 'daybtn', 'aria-pressed': String(r.days.includes(d)), onclick: () => { list[i].days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort(); save(list); } }, n))))) : h('p', { class: 'note' }, t('remNone')),
      list.length < MAX_REMINDERS ? h('button', { type: 'button', class: 'btn ghost', id: 'rem-add', onclick: () => save([...list, { id: `r${Date.now().toString(36)}`, kind: 'walk', time: '18:00', days: [0, 1, 2, 3, 4, 5, 6], on: true }]) }, t('remAdd')) : null);
  };
  draw(); return box;
}

/** Android only: permissions for the background features. */
function backgroundBlock() {
  const redraw = () => { // the permission dialog is answered outside the page: redraw when the page is back in front
    const back = () => { if (document.hidden) return; document.removeEventListener('visibilitychange', back); removeEventListener('focus', back); setTimeout(() => dispatchEvent(new HashChangeEvent('hashchange')), 300); };
    document.addEventListener('visibilitychange', back); addEventListener('focus', back);
  };
  const row = (on, onKey, askKey, ask, id) => on ? h('p', { class: 'note', id }, t(onKey)) : h('button', { type: 'button', class: 'btn ghost', id, onclick: () => { ask(); redraw(); } }, t(askKey));
  return h('div', { class: 'bg', id: 'f-s-bg' }, h('h2', null, t('bgTitle')), h('p', { class: 'note' }, t('bgNote')),
    row(native.notificationsAllowed(), 'bgNotifyOn', 'bgNotifyAsk', () => native.requestNotifications(), 'bg-notify'), row(native.stepsAvailable(), 'bgStepsOn', 'bgStepsAsk', () => native.requestActivity(), 'bg-steps'));
}

const openSecs = new Map(); // which sections the person opened or closed survives a redraw (toggles)
export function renderSettings(focusId) {
  const redraw = () => dispatchEvent(new HashChangeEvent('hashchange'));
  const num = (id, key, def, lo, hi, step = 1) => h('input', { id, type: 'number', inputMode: 'numeric', min: lo, max: hi, step, value: getNum(key, def, lo, hi), onchange: (e) => setPref(key, Math.min(hi, Math.max(lo, Number(e.target.value) || def))) });
  const smart = sanitizeSmart(getJson('smart', {})), saveSmart = (patch) => { setJson('smart', sanitizeSmart({ ...sanitizeSmart(getJson('smart', {})), ...patch })); checkReminders().catch(() => {}); syncNative(); };
  const ns = notifyState(), nbtn = h('button', { type: 'button', class: 'btn ghost', id: 'notify-btn', disabled: ns === 'granted' || ns === 'unsupported' || ns === 'denied', onclick: async (e) => { await askNotify(); redraw(); } }, ns === 'granted' ? t('remNotifyOn') : ns === 'denied' ? t('remNotifyOff') : t('remNotify'));
  const el = h('section', { class: 'settings' }, h('h1', null, t('settings')),
    h('h2', null, t('look')),
    field(t('language'), select('s-lang', getPref('lang', 'he'), [['he', 'עברית'], ['en', 'English']], (v) => { setPref('lang', v); setLang(v); syncNative(); redraw(); }), 's-lang'),
    field(t('theme'), select('s-theme', getPref('theme', 'auto'), [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], (v) => { setPref('theme', v); applyLook(); }), 's-theme'),
    field(t('look'), select('s-pack', getPref('pack', 'momentum'), PACKS.map(([v, k]) => [v, t(k)]), (v) => { setPref('pack', v); applyLook(); }), 's-pack'),
    h('h2', null, t('profile')),
    field(t('age'), num('s-age', 'age', 35, 5, 100), 's-age'), field(t('height'), num('s-height', 'height', 170, 100, 230), 's-height'), field(`${t('weight')} (${t('kg')})`, num('s-weight', 'weight', 70, 30, 250), 's-weight'),
    h('h2', null, t('wEffort')),
    check('s-effort', `${t('effortAlerts')}`, getPref('effortAlerts', '1') === '1', (on) => setPref('effortAlerts', on ? '1' : '0')), h('p', { class: 'note' }, t('effortAlertsHint')),
    h('h2', { id: 'f-s-reco' }, t('recoTitle')),
    check('s-online', t('setOnline'), onlineOn(), async (on) => { // opt-in: needs the approximate location; turning it off forgets it
      if (!on) { forgetWeather(); return redraw(); }
      try { setLoc(await locate()); setPref('onlineWx', '1'); } catch { const m = document.getElementById('online-msg'); if (m) m.textContent = t('setLocNeed'); document.getElementById('s-online').checked = false; return; }
      redraw();
    }), h('p', { class: 'note' }, t('setOnlineHint')), h('p', { class: 'err', id: 'online-msg', role: 'status' }),
    getLoc() ? h('p', { class: 'note', id: 'loc-saved' }, t('setLocSaved', getLoc())) : null,
    getLoc() ? h('button', { type: 'button', class: 'btn ghost', id: 'loc-forget', onclick: () => { forgetWeather(); redraw(); } }, t('setLocClear')) : null,
    check('s-reco-notify', t('setRecoNotify'), getPref('recoNotify', '0') === '1' && onlineOn(), (on) => { if (on && !onlineOn()) { document.getElementById('s-reco-notify').checked = false; const m = document.getElementById('online-msg'); if (m) m.textContent = t('setLocNeed'); return; } setPref('recoNotify', on ? '1' : '0'); syncNative(); }), h('p', { class: 'note' }, t('setRecoNotifyHint')),
    h('h2', { id: 'f-s-plan' }, t('planTitle')),
    check('s-plan-remind', t('planRemind'), getPref('planRemind', '1') === '1', (on) => { setPref('planRemind', on ? '1' : '0'); syncNative(); }),
    field(t('planRemindHour'), h('input', { id: 's-plan-hour', type: 'number', inputMode: 'numeric', min: 5, max: 22, value: getNum('planHour', 18, 5, 22), onchange: (e) => { setPref('planHour', Math.min(22, Math.max(5, Number(e.target.value) || 18))); syncNative(); } }), 's-plan-hour'),
    h('h2', { id: 'f-s-rem' }, t('remTitle')), remindersBlock(),
    check('s-smart', t('remSmart'), smart.on, (on) => saveSmart({ on })), h('p', { class: 'note' }, t('remSmartHint')),
    field(t('remFrom'), num('s-from', 'smartFrom', smart.fromHour, 0, 23), 's-from'), field(t('remTo'), num('s-to', 'smartTo', smart.toHour, 1, 24), 's-to'),
    field(t('remAfter'), num('s-after', 'smartAfter', smart.afterMin, 30, 480, 5), 's-after'), field(t('remMax'), num('s-max', 'smartMax', smart.maxPerDay, 1, 8), 's-max'),
    nbtn, h('p', { class: 'note' }, t('remNote')),
    native.available ? backgroundBlock() : null,
    h('h2', null, t('setCues')), check('s-cues', t('setCues'), getPref('cues', '1') !== '0', (on) => setPref('cues', on ? '1' : '0')), h('p', { class: 'note' }, t('setCuesHint')),
    field(t('chSet'), select('s-challenge', String(getNum('challengeN', 3, 0, 7)), [['0', t('chOffOpt')], ...[2, 3, 4, 5].map((n) => [String(n), t('chN', { n })])], (v) => { setPref('challengeN', v); }), 's-challenge'), h('p', { class: 'note' }, t('chSetHint')),
    check('s-weekly', t('setWeekly'), getPref('weeklyNotify', '0') === '1', (on) => { setPref('weeklyNotify', on ? '1' : '0'); syncNative(); }), h('p', { class: 'note' }, t('setWeeklyHint')),
    check('s-stophint', t('setStopHint'), getPref('stopHint', '1') !== '0', (on) => setPref('stopHint', on ? '1' : '0')),
    check('s-sun', t('setSun'), getPref('sun', '0') === '1', (on) => { setPref('sun', on ? '1' : '0'); }),
    check('s-tiles', t('setTiles'), getPref('mapTiles', '0') === '1', (on) => setPref('mapTiles', on ? '1' : '0')), h('p', { class: 'note' }, t('setTilesHint')),
    check('s-voice', t('setVoice'), getPref('voice', '0') === '1', (on) => setPref('voice', on ? '1' : '0')), h('p', { class: 'note' }, t('setVoiceHint')),
    check('s-cue-vibrate', t('setCueVibrate'), getPref('cueVibrate', '1') !== '0', (on) => setPref('cueVibrate', on ? '1' : '0')),
    h('h2', null, t('metroSection')),
    field(t('breath'), select('s-breath', getPref('breath', '3:2'), [['3:2', t('breath32')], ['2:2', t('breath22')], ['2:1', t('breath21')], ['off', t('breathOff')]], (v) => setPref('breath', v)), 's-breath'),
    field(t('volume'), h('input', { id: 's-vol', type: 'range', min: 0, max: 100, step: 5, value: getNum('volume', 60, 0, 100), oninput: (e) => setPref('volume', e.target.value) }), 's-vol'),
    field(t('defaultBpm'), num('s-bpm', 'bpm', 170, 100, 230), 's-bpm'),
    h('p', { class: 'note' }, t('stepsNote')),
    h('h2', { id: 'f-s-backup' }, t('bkTitle')), backupBlock(),
    h('h2', { id: 'f-s-about' }, t('aboutTitle')), aboutBlock());
  // group each heading with what follows it into a collapsible section (Look and Profile start open); open/closed is remembered by the heading's text
  const secs = []; let cur = null;
  for (const n of [...el.children].slice(1)) {
    if (n.tagName !== 'H2') { if (cur) cur.append(n); continue; } // anything before the first heading stays where it is
    const key = n.textContent, first = secs.length < 2; cur = h('details', { class: 'sec', open: openSecs.has(key) ? openSecs.get(key) : first, ontoggle: (e) => { openSecs.set(key, e.target.open); } }, h('summary', null, n)); secs.push(cur);
  }
  el.append(...secs);
  // the smart-nudge numbers are stored together in one JSON object (validated on every read)
  for (const [id, key] of [['s-from', 'fromHour'], ['s-to', 'toHour'], ['s-after', 'afterMin'], ['s-max', 'maxPerDay']]) el.querySelector(`#${id}`).onchange = (e) => saveSmart({ [key]: Number(e.target.value) });
  if (focusId && /^[\w-]{1,30}$/.test(focusId)) queueMicrotask(() => { const f = el.querySelector(`#f-${CSS.escape(focusId)}`) || el.querySelector(`#${CSS.escape(focusId)}`); const box = f?.closest('details'); if (box) { box.open = true; } f?.scrollIntoView({ block: 'center' }); (f?.querySelector('select,input,button') || f)?.focus?.({ preventScroll: true }); });
  return el;
}
