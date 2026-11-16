// Copies the celebration kit pictures the app actually uses (design/stepup/celebration) into web/art/celebrate. Run: node scripts/sync-celebration.mjs
import { readdirSync, copyFileSync, mkdirSync } from 'node:fs';
const SRC = 'design/stepup/celebration', DST = 'web/art/celebrate';
mkdirSync(DST, { recursive: true }); let n = 0;
for (const dir of ['podium', 'cards', 'badges']) for (const f of readdirSync(`${SRC}/${dir}`)) if (f.endsWith('.svg')) { copyFileSync(`${SRC}/${dir}/${f}`, `${DST}/${f}`); n++; }
console.log(`celebration art ok (${n} SVGs)`);
