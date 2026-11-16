// Copies the kit pictures the app uses into web/art: the celebration kit (podium, record cards, badges) and the workout kit (time-of-day banners,
// workout card backgrounds, countdown numerals, hand-free hints). Run: node scripts/sync-celebration.mjs
import { readdirSync, copyFileSync, mkdirSync } from 'node:fs';
let n = 0;
const copy = (src, dst, name = (f) => f) => { mkdirSync(dst, { recursive: true }); for (const f of readdirSync(src)) if (f.endsWith('.svg')) { copyFileSync(`${src}/${f}`, `${dst}/${name(f)}`); n++; } };
for (const dir of ['podium', 'cards', 'badges']) copy(`design/stepup/celebration/${dir}`, 'web/art/celebrate');
for (const [dir, prefix] of [['banners', 'banner'], ['cards', 'card'], ['countdown', 'count'], ['hints', 'hint']]) copy(`design/stepup/workoutkit/${dir}`, 'web/art/workout', (f) => `${prefix}-${f}`);
console.log(`kit art ok (${n} SVGs)`);
