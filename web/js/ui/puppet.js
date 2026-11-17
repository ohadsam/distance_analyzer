// The paper-puppet character: parts of one atlas picture stacked in a joint hierarchy and rotated around their joints by the rig's keyframes (puppetRig.js).
// `data` describes the art: { atlas: url, stage: px, ground: [x, y], parts: { torso: { rect: [x, y, w, h], pivot: [px, py] (inside the rect), parent: null, at: [x, y] (the joint, relative to the parent's joint; for the root the stage position), z: -1 | 1 (behind / in front) }, ... } }.
// Decorative (aria-hidden). Animation uses the Web Animations API (transform only); the calm switch and reduced motion freeze it on the first frame.
import { h } from '../util.js';
import { PARTS, CYCLE, keyframes, pose } from '../puppetRig.js';

const still = (kind) => { const p = pose(kind, 0); return (k) => (k === 'torso' ? `translateY(${p[k].y}px) rotate(${p[k].r}deg)` : k === 'shadow' ? `scaleX(${p[k].s})` : `rotate(${p[k].r}deg)`); };
export const calmNow = () => document.documentElement.dataset.calm === '1' || !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createPuppet(data, kind = 'walk', size = 120, { animate = true } = {}) {
  const k = kind === 'run' ? 'run' : 'walk', stage = h('span', { class: 'pp-stage', style: { 'inline-size': `${data.stage}px`, 'block-size': `${data.stage}px`, transform: `scale(${size / data.stage})` } });
  const root = h('span', { class: `puppet puppet-${k}`, 'aria-hidden': 'true', style: { 'inline-size': `${size}px`, 'block-size': `${size}px` } }, stage), joints = {}, tf = still(k);
  for (const name of PARTS) {
    const d = data.parts[name]; if (!d) continue;
    const joint = h('span', { class: `pp-joint pp-${name}`, style: { left: `${d.at[0]}px`, top: `${d.at[1]}px`, 'z-index': String(d.z ?? 1), transform: tf(name) } });
    joint.append(h('span', { class: 'pp-art', style: { left: `${-d.pivot[0]}px`, top: `${-d.pivot[1]}px`, 'inline-size': `${d.rect[2]}px`, 'block-size': `${d.rect[3]}px`, 'background-image': `url(${data.atlas})`, 'background-position': `${-d.rect[0]}px ${-d.rect[1]}px` } }));
    joints[name] = joint; (d.parent ? joints[d.parent] || stage : stage).append(joint);
  }
  const anims = [];
  function play() { if (anims.length || calmNow()) return; const kf = keyframes(k, 32); for (const name of Object.keys(joints)) anims.push(joints[name].animate(kf[name], { duration: CYCLE[k].ms, iterations: Infinity, easing: 'linear' })); }
  function stop() { while (anims.length) anims.pop().cancel(); }
  const sync = () => { if (animate && !calmNow()) play(); else stop(); };
  if (animate) { sync(); addEventListener('stepup-calm', sync); root.cleanup = () => { stop(); removeEventListener('stepup-calm', sync); }; }
  return root;
}
