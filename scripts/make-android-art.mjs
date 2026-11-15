// Renders the kit's widget backgrounds and splash icon (design/stepup/extension) to the PNGs Android uses (light + night). Run: node scripts/make-android-art.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const KIT = 'design/stepup/extension', RES = 'android/app/src/main/res';
const jobs = [];
for (const [src, name] of [['steps', 'steps'], ['effort', 'effort'], ['last-workout', 'last'], ['next-session', 'next']]) {
  for (const [mode, dir] of [['light', 'drawable-nodpi'], ['dark', 'drawable-night-nodpi']]) jobs.push([`${KIT}/widgets/${src}-wide-${mode}.svg`, `${RES}/${dir}/widget_bg_${name}.png`, 600, 300]);
}
for (const [mode, dir] of [['light', 'drawable-nodpi'], ['dark', 'drawable-night-nodpi']]) jobs.push([`${KIT}/splash/android-icon-${mode}.svg`, `${RES}/${dir}/splash_icon.png`, 432, 432]);
const b = await chromium.launch(), p = await b.newPage();
for (const [src, out, w, h] of jobs) {
  mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<body style="margin:0;background:transparent">${readFileSync(src, 'utf8').replace('<svg ', `<svg width="${w}" height="${h}" `)}</body>`);
  writeFileSync(out, await p.screenshot({ omitBackground: true, type: 'png' }));
}
await b.close(); console.log(`android art ok (${jobs.length} PNGs)`);
