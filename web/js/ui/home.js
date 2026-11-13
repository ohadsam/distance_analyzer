import { h } from '../util.js';
import { t } from '../i18n.js';

export function renderHome() {
  return h('section', null, h('h1', null, t('hello')), h('p', { class: 'note' }, t('helloHint')));
}
