// "Your data": save everything to one file, or restore from such a file. Web: download / file picker. Android: the system file dialogs (bridge).
import { h, setChildren } from '../util.js';
import { t } from '../i18n.js';
import { native } from '../native.js';
import { buildBackup, parseBackup, applyBackup } from '../backup.js';

const stamp = () => new Date().toISOString().slice(0, 10);

export function backupBlock() {
  const out = h('p', { class: 'note', id: 'backup-msg', role: 'status' }), say = (m) => setChildren(out, m);
  async function save() {
    say(t('bkWorking'));
    try {
      const json = JSON.stringify(await buildBackup()), name = `stepup-backup-${stamp()}.json`;
      if (native.available) { const r = await native.saveBackup(json, name); return say(r?.ok ? t('bkSaved') : t('bkCancelled')); }
      const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      say(t('bkSaved'));
    } catch { say(t('bkError')); }
  }
  async function restoreText(text) {
    const p = parseBackup(text);
    if (p.error) return say(t(p.error === 'size' ? 'bkTooBig' : 'bkBad'));
    if (!confirm(t('bkConfirm', { w: p.workouts.length, r: p.routes.length }))) return say('');
    const c = await applyBackup(p); say(t('bkRestored', { w: c.workouts, r: c.routes }));
    setTimeout(() => location.reload(), 1200); // language, look and every screen pick up the restored settings
  }
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, id: 'backup-file', 'aria-label': t('bkRestore'), onchange: async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) restoreText(f.size > 25e6 ? '' : await f.text()); } });
  async function restore() {
    if (!native.available) return file.click();
    const r = await native.pickBackup(); if (!r?.ok) return say(t('bkCancelled'));
    restoreText(native.takeBackup());
  }
  return h('div', { class: 'backup' }, h('p', { class: 'note' }, t('bkNote')),
    h('button', { type: 'button', class: 'btn ghost', id: 'backup-save', onclick: save }, t('bkSave')),
    h('button', { type: 'button', class: 'btn ghost', id: 'backup-restore', onclick: restore }, t('bkRestore')), file, out);
}
