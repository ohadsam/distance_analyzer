import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shareLinks } from '../../web/js/appShare.js';
import { CHANGES, changesFor } from '../../web/js/changelog.js';

test('share links: WhatsApp and e-mail carry the whole text, percent-encoded', () => {
  const text = 'Try StepUp - Web: https://ohadsam.github.io/distance_analyzer/ & APK: https://x/stepup.apk', l = shareLinks(text, 'StepUp app');
  assert.ok(l.whatsapp.startsWith('https://wa.me/?text='));
  assert.equal(decodeURIComponent(l.whatsapp.slice('https://wa.me/?text='.length)), text);
  assert.ok(l.mail.startsWith('mailto:?subject=StepUp%20app&body='));
  assert.ok(!/[ &<>"]/.test(l.whatsapp.slice('https://wa.me/?text='.length)), 'nothing unencoded');
  assert.ok(shareLinks('x'.repeat(2000)).whatsapp.length < 800, 'long text is capped');
});

test('what is new: the running version is listed, both languages, newest first, no duplicates', () => {
  const v = JSON.parse(readFileSync('web/version.json', 'utf8')).version;
  assert.equal(CHANGES[0].v, v, 'the newest entry is the running version');
  assert.ok(changesFor(v));
  assert.equal(new Set(CHANGES.map((c) => c.v)).size, CHANGES.length);
  for (const c of CHANGES) { assert.ok(c.en.length && c.en.length === c.he.length, `${c.v}: same number of bullets in en and he`); for (const x of [...c.en, ...c.he]) assert.ok(x.length > 5 && x.length < 220); }
  const log = readFileSync('docs/CHANGELOG.md', 'utf8');
  for (const c of CHANGES) assert.ok(log.includes(`## ${c.v}`), `docs/CHANGELOG.md has ${c.v}`);
});
