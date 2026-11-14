import { h } from '../util.js';
import { t, setLang } from '../i18n.js';
import { getPref, setPref, getNum } from '../store.js';
import { native } from '../native.js';

const PACKS = [['momentum', 'packMomentum'], ['ocean', 'packOcean'], ['forest', 'packForest'], ['sunset', 'packSunset'], ['violet', 'packViolet'], ['slate', 'packSlate'], ['mono', 'packMono'], ['high-contrast', 'packHigh']];
const opt = (value, label, cur) => h('option', { value, selected: value === cur }, label);
const field = (label, control, id) => h('div', { class: 'field' }, h('label', { for: id }, label), control);
const select = (id, value, items, onchange) => h('select', { id, onchange: (e) => onchange(e.target.value) }, items.map(([v, l]) => opt(v, l, value)));

export function applyLook() {
  const root = document.documentElement, theme = ['light', 'dark'].includes(getPref('theme', 'auto')) ? getPref('theme') : 'auto', pack = PACKS.some(([v]) => v === getPref('pack', 'momentum')) ? getPref('pack') : 'momentum'; // storage is untrusted: only known values reach the DOM
  if (theme === 'auto') delete root.dataset.theme; else root.dataset.theme = theme;
  if (pack === 'momentum') delete root.dataset.pack; else root.dataset.pack = pack;
  const bg = getComputedStyle(root).getPropertyValue('--background').trim(); if (bg) document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg);
}

export function renderSettings() {
  const redraw = () => dispatchEvent(new HashChangeEvent('hashchange'));
  const num = (id, key, def, lo, hi, step = 1) => h('input', { id, type: 'number', inputMode: 'numeric', min: lo, max: hi, step, value: getNum(key, def, lo, hi), onchange: (e) => setPref(key, Math.min(hi, Math.max(lo, Number(e.target.value) || def))) });
  return h('section', null, h('h1', null, t('settings')),
    h('h2', null, t('look')),
    field(t('language'), select('s-lang', getPref('lang', 'he'), [['he', 'עברית'], ['en', 'English']], (v) => { setPref('lang', v); setLang(v); redraw(); }), 's-lang'),
    field(t('theme'), select('s-theme', getPref('theme', 'auto'), [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], (v) => { setPref('theme', v); applyLook(); }), 's-theme'),
    field(t('look'), select('s-pack', getPref('pack', 'momentum'), PACKS.map(([v, k]) => [v, t(k)]), (v) => { setPref('pack', v); applyLook(); }), 's-pack'),
    h('h2', null, t('metroSection')),
    field(t('breath'), select('s-breath', getPref('breath', '3:2'), [['3:2', t('breath32')], ['2:2', t('breath22')], ['2:1', t('breath21')], ['off', t('breathOff')]], (v) => setPref('breath', v)), 's-breath'),
    field(t('volume'), h('input', { id: 's-vol', type: 'range', min: 0, max: 100, step: 5, value: getNum('volume', 60, 0, 100), oninput: (e) => setPref('volume', e.target.value) }), 's-vol'),
    field(t('defaultBpm'), num('s-bpm', 'bpm', 170, 100, 230), 's-bpm'),
    h('h2', null, t('kcal')),
    field(`${t('weight')} (${t('kg')})`, num('s-weight', 'weight', 70, 30, 250), 's-weight'),
    h('p', { class: 'note' }, t('stepsNote')), h('p', { class: 'note', id: 'ver' }, t('version', { v: native.version() || '' })));
}
