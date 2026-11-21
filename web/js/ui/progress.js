// A progress bar for anything that loads: determinate (set(done, total)) or indeterminate (a moving stripe). role=progressbar for assistive technology; the label says what is loading.
import { h } from '../util.js';

/** { el, set(done, total, label?), stop() }: `el` goes on the page; `stop()` removes it (call when the work ends). Without set(), the bar is indeterminate. */
export function progressBar(label = '', { id } = {}) {
  const fill = h('i', null), text = h('span', { class: 'pbtext' }, label), el = h('div', { class: 'pbar indeterminate', role: 'progressbar', 'aria-label': label || undefined, 'aria-busy': 'true', ...(id ? { id } : {}) }, h('div', { class: 'pbtrack' }, fill), text);
  return {
    el,
    set(done, total, text2) {
      const pct = total > 0 ? Math.max(0, Math.min(100, Math.round(done / total * 100))) : 0;
      el.classList.remove('indeterminate'); el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100'); el.setAttribute('aria-valuenow', String(pct)); fill.style.setProperty('inline-size', `${pct}%`);
      if (text2 != null) { text.textContent = text2; el.setAttribute('aria-label', text2); }
    },
    stop() { el.remove(); },
  };
}
