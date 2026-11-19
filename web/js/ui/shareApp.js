// The "Share StepUp" sheet: WhatsApp, e-mail, the phone's share menu or a copied link. Sends only the app's two links (the text from strings), never data about the person.
import { h, setChildren } from '../util.js';
import { t } from '../i18n.js';
import { native } from '../native.js';
import { APK_URL, SITE_URL, shareApp } from '../update.js';
import { shareLinks } from '../appShare.js';

export function openShareApp() {
  const text = t('shareText', { site: SITE_URL, apk: APK_URL }), l = shareLinks(text, t('shareMailSubject'));
  const dlg = h('dialog', { class: 'permsheet', id: 'share-sheet', 'aria-labelledby': 'share-sheet-title' }), out = h('p', { class: 'note', role: 'status', id: 'share-msg' });
  const close = () => { if (dlg.open) dlg.close(); dlg.remove(); };
  const link = (id, href, label) => h('a', { class: 'btn', id, href, target: '_blank', rel: 'noopener noreferrer' }, label);
  const run = async (how) => { setChildren(out, how === 'copied' ? t('shareCopied') : how === 'manual' ? h('span', null, t('shareManual'), h('input', { readOnly: true, value: text, 'aria-label': t('shareTitle'), onfocus: (e) => e.target.select() })) : null); };
  setChildren(dlg, h('h2', { id: 'share-sheet-title' }, t('shareTitle')), h('p', { class: 'note' }, t('shareHint')),
    h('div', { class: 'sheetbtns' }, link('share-wa', l.whatsapp, t('shareWa')), link('share-mail', l.mail, t('shareMail'))),
    h('div', { class: 'sheetbtns' }, h('button', { type: 'button', class: 'btn ghost', id: 'share-more', onclick: async () => run(await shareApp(text, { native })) }, t('shareMore')),
      h('button', { type: 'button', class: 'btn ghost', id: 'share-copy', onclick: async () => { try { await navigator.clipboard.writeText(text); run('copied'); } catch { run('manual'); } } }, t('shareCopy'))),
    out, h('button', { type: 'button', class: 'btn ghost', id: 'share-close', autofocus: true, onclick: close }, t('shareClose')));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  document.body.append(dlg); dlg.showModal();
}
