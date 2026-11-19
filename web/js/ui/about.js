// "Update" (a box at the top of Settings: check, and on Android download + install the new APK as an update) and "About" (version, the manual APK link, sharing).
import { h, setChildren } from '../util.js';
import { t } from '../i18n.js';
import { art } from '../art.js';
import { native, onNativeEvent } from '../native.js';
import { APP_VERSION } from '../appVersion.js';
import { APK_URL, checkUpdate } from '../update.js';
import { openShareApp } from './shareApp.js';
import { openWhatsNew } from './whatsnew.js';
import { onPermissionsChanged } from '../permissions.js';

/** Fetch the new service worker and reload once it has taken over (or at once when there is nothing new to wait for). */
async function refreshApp() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration(); if (!reg) return location.reload();
    const taken = new Promise((res) => { navigator.serviceWorker.addEventListener('controllerchange', res, { once: true }); setTimeout(res, 10000); });
    await reg.update();
    if (reg.installing || reg.waiting) await taken;
  } catch { /* offline: reload with what we have */ }
  location.reload();
}

let lastUpdate = null; // the phone's last update event, kept while the box is not on screen (the download goes on when you leave Settings)
onNativeEvent((e) => { if (e?.type === 'update') lastUpdate = e; });
const ERR = ['url', 'http', 'size', 'checksum', 'invalid', 'package', 'same', 'signature', 'install', 'failed'];

/** The update box: "Check for updates"; when a newer version exists the web app refreshes itself and the Android app downloads and installs it as an update (data stays). */
export function updateBox() {
  const out = h('p', { class: 'note', id: 'upd-msg', role: 'status' }), extra = h('div', { class: 'upd-extra' }), bar = h('progress', { max: 100, id: 'upd-progress', hidden: true, 'aria-label': t('updSection') });
  const say = (text, ...more) => { out.textContent = text; setChildren(extra, ...more); };
  const manual = () => h('a', { class: 'btn ghost', id: 'upd-manual', href: APK_URL, rel: 'noopener noreferrer' }, t('updManual'));
  let waitingForInstallPermission = false;
  function install() { // Android: allowed to install? then download, verify and hand over to the installer
    if (native.permissionState().install !== 'granted') {
      waitingForInstallPermission = true; return say(t('updNeedInstall'), h('button', { type: 'button', class: 'btn', id: 'upd-allow', onclick: () => native.requestPermission('install') }, t('updAllowInstall')));
    }
    waitingForInstallPermission = false;
    if (!native.updateStart(APK_URL)) say(t('updErr_failed'), manual()); else { bar.hidden = false; bar.removeAttribute('value'); say(t('updDownloadingNoPct')); }
  }
  function show(e) {
    const s = e.state, pct = Number.isFinite(e.pct) ? e.pct : -1;
    if (s === 'need-permission') return install();
    bar.hidden = !(s === 'downloading' || s === 'verifying' || s === 'installing'); if (!bar.hidden && pct >= 0) bar.value = pct; else if (!bar.hidden) bar.removeAttribute('value');
    if (s === 'downloading') say(pct >= 0 ? t('updDownloading', { pct }) : t('updDownloadingNoPct'));
    else if (s === 'verifying') say(t('updVerifying')); else if (s === 'installing') say(t('updInstalling')); else if (s === 'confirm') say(t('updConfirm'));
    else if (s === 'done') say(t('updDone')); else if (s === 'error') say(t(`updErr_${ERR.includes(e.reason) ? e.reason : 'failed'}`), manual());
  }
  const stopEvents = onNativeEvent((e) => { if (!out.isConnected) return stopEvents(); if (e?.type === 'update') show(e); }); // the installer's progress, from the phone
  if (lastUpdate && (native.updateRunning() || ['confirm', 'done', 'error'].includes(lastUpdate.state))) queueMicrotask(() => show(lastUpdate)); // back in Settings: pick up where it is
  const stopPerm = onPermissionsChanged(() => { if (!out.isConnected) return stopPerm(); if (waitingForInstallPermission && native.permissionState().install === 'granted') install(); }); // back from Android's "allow installing" screen
  const check = h('button', { type: 'button', class: 'btn', id: 'upd-check', onclick: async () => {
    check.disabled = true; bar.hidden = true; lastUpdate = null; say(t('updChecking'));
    const current = native.version() || APP_VERSION, r = await checkUpdate(current);
    check.disabled = false;
    if (r.state === 'error') return say(t('updError'), art('onboarding', 'offline'));
    if (r.state === 'latest') return say(t('updLatest', { v: current }));
    // a newer release: the installed web app refreshes itself; the Android app downloads it and installs it over itself
    say(t('updNewer', { v: r.version }), r.notes ? h('p', { class: 'note' }, r.notes) : null,
      native.available ? h('button', { type: 'button', class: 'btn', id: 'upd-install', onclick: install }, t('updInstall')) : h('button', { type: 'button', class: 'btn', id: 'upd-refresh', onclick: refreshApp }, t('updRefresh')));
  } }, t('updCheck'));
  return h('div', { class: 'card updbox', id: 'f-s-update' }, h('div', { class: 'row' }, h('b', { id: 'about-version' }, t('aboutVersion', { v: APP_VERSION })), check), out, bar, extra);
}

export function aboutBlock() {
  const share = h('button', { type: 'button', class: 'btn ghost', id: 'share-app', onclick: openShareApp }, t('shareApp'));
  return h('div', { class: 'about' }, h('a', { class: 'btn ghost', id: 'upd-apk', href: APK_URL, rel: 'noopener noreferrer' }, t('updApk')), h('p', { class: 'note' }, t('updApkHint')), h('div', { class: 'row' }, share, h('button', { type: 'button', class: 'btn ghost', id: 'whats-new', onclick: openWhatsNew }, t('wnOpen'))));
}
