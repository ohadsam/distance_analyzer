// "About and updates": the running version, a manual update check, the newest Android app and sharing the app.
import { h, setChildren } from '../util.js';
import { t } from '../i18n.js';
import { native } from '../native.js';
import { APP_VERSION } from '../appVersion.js';
import { APK_URL, SITE_URL, checkUpdate, shareApp } from '../update.js';

export function aboutBlock() {
  const out = h('p', { class: 'note', id: 'upd-msg', role: 'status' }), extra = h('div', { class: 'upd-extra' });
  const say = (text, ...more) => { out.textContent = text; setChildren(extra, ...more); };
  const check = h('button', { type: 'button', class: 'btn ghost', id: 'upd-check', onclick: async () => {
    check.disabled = true; say(t('updChecking'));
    const r = await checkUpdate(native.version() || APP_VERSION);
    check.disabled = false;
    if (r.state === 'error') return say(t('updError'));
    if (r.state === 'latest') return say(t('updLatest', { v: APP_VERSION }));
    // a newer release: the installed web app refreshes itself; the Android app downloads the new APK
    say(t('updNewer', { v: r.version }), r.notes ? h('p', { class: 'note' }, r.notes) : null,
      native.available ? h('a', { class: 'btn', id: 'upd-apk-new', href: APK_URL, rel: 'noopener noreferrer' }, t('updApk'))
        : h('button', { type: 'button', class: 'btn', id: 'upd-refresh', onclick: async () => { try { (await navigator.serviceWorker?.getRegistration())?.update(); } catch { /* offline */ } setTimeout(() => location.reload(), 600); } }, t('updRefresh')));
  } }, t('updCheck'));
  const shareOut = h('p', { class: 'note', id: 'share-msg', role: 'status' }), shareText = () => t('shareText', { site: SITE_URL, apk: APK_URL });
  const share = h('button', { type: 'button', class: 'btn ghost', id: 'share-app', onclick: async () => {
    const text = shareText(), how = await shareApp(text, { native });
    setChildren(shareOut, how === 'copied' ? t('shareCopied') : how === 'manual' ? h('span', null, t('shareManual'), h('input', { readOnly: true, value: text, 'aria-label': t('shareApp'), onfocus: (e) => e.target.select() })) : null);
  } }, t('shareApp'));
  return h('div', { class: 'about' }, h('p', { id: 'about-version' }, t('aboutVersion', { v: APP_VERSION })), check, out, extra,
    h('a', { class: 'btn ghost', id: 'upd-apk', href: APK_URL, rel: 'noopener noreferrer' }, t('updApk')), h('p', { class: 'note' }, t('updApkHint')), share, shareOut);
}
