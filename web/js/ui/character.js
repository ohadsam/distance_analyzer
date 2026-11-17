// The StepUp character (the illustrator's art, cleaned and cut by scripts/make-character-sprites.py): a looping walk or run cycle (a strip of 8 frames played with
// steps()) and still poses. Decorative pictures (alt=""). Nothing moves unless the element has .anim-on (the calm switch and reduced motion stop it, see app.css).
import { h } from '../util.js';
import { CHARACTER } from '../characterData.js';

/** A walking or running character, `size` px square. kind: 'walk' | 'run'. */
export function walker(kind, size = 88, { animate = true } = {}) {
  const c = CHARACTER.cycles[kind === 'run' ? 'run' : 'walk'];
  return h('span', { class: `char char-cycle char-${kind === 'run' ? 'run' : 'walk'}${animate ? ' anim-on' : ''}`, 'aria-hidden': 'true', style: { 'inline-size': `${size}px`, 'block-size': `${size}px`, '--ms': `${c.ms}ms`, '--n': String(c.frames) } },
    h('img', { src: c.file, alt: '', draggable: false, width: c.w * c.frames, height: c.h }));
}
/** A still pose (idle, jump, cheer, wave, rest, stretch, medal, trophy, podium, point, think, sit, sleep, rain). */
export function pose(name, size = 96) {
  const p = CHARACTER.poses[name] || CHARACTER.poses.idle;
  return h('img', { class: 'char char-pose', src: p.file, alt: '', draggable: false, width: size, height: size, 'aria-hidden': 'true' });
}
export const hasPose = (name) => Object.hasOwn(CHARACTER.poses, name);
