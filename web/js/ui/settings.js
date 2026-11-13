import { h } from '../util.js';
import { t, setLang } from '../i18n.js';
import { getPref, setPref } from '../app.js';
import { native } from '../native.js';

const opt = (value, label, cur) => h('option', { value, selected: value === cur }, label);

export function renderSettings() {
  const lang = getPref('lang', 'he'), theme = getPref('theme', 'auto');
  return h('section', null, h('h1', null, t('settings')),
    h('label', { class: 'field' }, t('language'),
      h('select', { onchange: (e) => { setPref('lang', e.target.value); setLang(e.target.value); dispatchEvent(new HashChangeEvent('hashchange')); } }, opt('he', 'עברית', lang), opt('en', 'English', lang))),
    h('label', { class: 'field' }, t('theme'),
      h('select', { onchange: (e) => { setPref('theme', e.target.value); if (e.target.value === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = e.target.value; } },
        opt('auto', t('themeAuto'), theme), opt('light', t('themeLight'), theme), opt('dark', t('themeDark'), theme))),
    h('p', { class: 'note', id: 'ver' }, t('version', { v: native.version() || '' })));
}
