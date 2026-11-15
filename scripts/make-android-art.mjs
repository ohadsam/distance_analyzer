// Renders the kit's widget backgrounds and splash icon (design/stepup/extension) to the PNGs Android uses (light + night). Run: node scripts/make-android-art.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const KIT = 'design/stepup/extension', RES = 'android/app/src/main/res';
const jobs = [];
for (const [src, name] of [['effort', 'effort'], ['last-workout', 'last'], ['next-session', 'next']]) {
  for (const [mode, dir] of [['light', 'drawable-nodpi'], ['dark', 'drawable-night-nodpi']]) jobs.push([`${KIT}/widgets/${src}-wide-${mode}.svg`, `${RES}/${dir}/widget_bg_${name}.png`, 750, 210, true]);
}
// the Steps widget is square (about 110 x 110 dp), so it gets the kit's square art
for (const [mode, dir] of [['light', 'drawable-nodpi'], ['dark', 'drawable-night-nodpi']]) jobs.push([`${KIT}/widgets/steps-square-${mode}.svg`, `${RES}/${dir}/widget_bg_steps.png`, 330, 330, true]);
for (const [mode, dir] of [['light', 'drawable-nodpi'], ['dark', 'drawable-night-nodpi']]) jobs.push([`${KIT}/splash/android-icon-${mode}.svg`, `${RES}/${dir}/splash_icon.png`, 432, 432]);
/** Widgets are wide and short (about 250 x 70 dp): the art keeps its shape (cropped from the top, so hills stay and nothing is squashed) and gets its own circular corners. */
function svgFor(svg, w, h, widget) {
  if (!widget) return svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
  return `<div style="width:${w}px;height:${h}px;border-radius:21px;overflow:hidden">${svg.replace('<svg ', `<svg width="${w}" height="${h}" preserveAspectRatio="xMidYMax slice" `)}</div>`;
}
const b = await chromium.launch(), p = await b.newPage();
for (const [src, out, w, h, widget] of jobs) {
  mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<body style="margin:0;background:transparent">${svgFor(readFileSync(src, 'utf8'), w, h, widget)}</body>`);
  writeFileSync(out, await p.screenshot({ omitBackground: true, type: 'png' }));
}
await b.close(); console.log(`android art ok (${jobs.length} PNGs)`);
