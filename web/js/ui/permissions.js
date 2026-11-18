// The permissions section of Settings and the sheet that opens at start-up when something is missing. Reads the state through permissions.js, asks on a tap, and
// redraws when the answer comes back. It does not decide what any feature does without a permission: each feature asks for what it needs.
import { h, setChildren } from '../util.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { setPref, flag } from '../store.js';
import { native } from '../native.js';
import { permissionList, requestPermission, onPermissionsChanged, missing } from '../permissions.js';

const KEYS = { location: ['permLocation', 'permLocationWhy'], notifications: ['permNotifications', 'permNotificationsWhy'], activity: ['permActivity', 'permActivityWhy'], battery: ['permBattery', 'permBatteryWhy'] };
const inWorkout = () => /^#\/workout/.test(location.hash);
const STATE = { granted: 'permGranted', ask: 'permAsk', blocked: 'permBlocked' };

function row(p, refresh) {
  const [title, why] = KEYS[p.id];
  const act = p.state === 'granted' ? null
    : p.state === 'blocked' && !native.available ? h('p', { class: 'note' }, t('permBlockedWeb')) // a browser has no way to open its own site settings for us
    : h('button', { type: 'button', class: p.state === 'ask' ? 'btn' : 'btn ghost', id: `perm-${p.id}`, onclick: async (e) => { e.currentTarget.disabled = true; await requestPermission(p.id); refresh(); } }, p.state === 'blocked' ? t('permOpenSettings') : t('permAllow'));
  return h('div', { class: 'permrow', role: 'listitem', 'data-perm': p.id, 'data-state': p.state },
    h('span', { class: 'permic' }, icon(p.icon, 24)), h('div', { class: 'permtx' }, h('b', null, t(title), ' ', h('span', { class: `permstate ${p.state}` }, t(STATE[p.state]))), h('small', null, t(why)), p.state === 'blocked' && native.available ? h('small', { class: 'note' }, t('permBlockedApp')) : null), act);
}

/** The list of permissions, kept current: it redraws by itself when an answer arrives or the person comes back from the phone's settings. */
function permList(onChange, requiredOnly = false) {
  const box = h('div', { class: 'perms', role: 'list' });
  async function refresh() { const list = await permissionList(); if (!box.isConnected) return stop(); const shown = requiredOnly ? list.filter((p) => p.required) : list; setChildren(box, shown.map((p) => row(p, refresh))); onChange?.(list); }
  const stop = onPermissionsChanged(refresh); refresh(); return { box, refresh, stop };
}

/** Settings section body. */
export function permissionsBlock() {
  const { box, refresh } = permList();
  const ask = h('input', { type: 'checkbox', id: 's-permask', checked: flag('permAsk'), onchange: (e) => setPref('permAsk', e.target.checked ? '1' : '0') });
  return h('div', null, h('p', { class: 'note' }, t('permIntro')), box, h('p', { class: 'note' }, t('permOnline')),
    h('label', { class: 'check' }, ask, h('span', null, t('permAskStart'))), h('button', { type: 'button', class: 'btn ghost', id: 'perm-refresh', onclick: refresh }, icon('refresh', 20), t('permRefresh')));
}

/** The start-up sheet: once per session, only when something we ask for is missing, never over a workout, and never again after "Do not ask again". */
export async function maybeShowPermissionSheet(list) {
  if (!flag('permAsk') || inWorkout()) return;
  try { if (sessionStorage.getItem('da.permShown')) return; } catch { /* storage blocked: ask once per page load */ }
  if (!missing(list || await permissionList()).length || inWorkout()) return; // (the person may have started a workout while we were reading)
  try { sessionStorage.setItem('da.permShown', '1'); } catch { /* ignore */ }
  openSheet();
}
function openSheet() {
  const dlg = h('dialog', { class: 'permsheet', id: 'perm-sheet', 'aria-labelledby': 'perm-sheet-title' }), done = h('p', { class: 'note', role: 'status', id: 'perm-done' });
  const close = () => { stop(); if (dlg.open) dlg.close(); dlg.remove(); };
  let askable = []; // what "Allow all" asks for, from the latest reading (one dialog at a time on Android, so one after the other)
  const all = h('button', { type: 'button', class: 'btn', id: 'perm-all', onclick: async (e) => { e.currentTarget.disabled = true; for (const p of askable) await requestPermission(p.id); refresh(); } }, t('permAllowAll'));
  const { box, refresh, stop } = permList((list) => {
    const need = missing(list); askable = need.filter((p) => p.state === 'ask'); all.hidden = !askable.length; all.disabled = false;
    if (!need.length) { done.textContent = t('permAllDone'); setTimeout(close, 1400); }
  }, true); // the sheet shows what is worth asking for at start-up; the optional rows are in Settings
  setChildren(dlg, h('h2', { id: 'perm-sheet-title' }, t('permTitle')), h('p', { class: 'note' }, t('permIntro')), box, h('p', { class: 'note' }, t('permOnline')), done,
    h('div', { class: 'row' }, all, h('button', { type: 'button', class: 'btn ghost', id: 'perm-later', onclick: close }, t('permNotNow'))),
    h('button', { type: 'button', class: 'linkbtn', id: 'perm-never', onclick: () => { setPref('permAsk', '0'); close(); } }, t('permNever')));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  document.body.append(dlg); dlg.showModal();
}
