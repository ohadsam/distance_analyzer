// Small dependency-free helpers shared by every module. Pure: no storage, no timers.
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Median of a list of numbers (0 for an empty list). */
export const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Strips control + bidi characters from untrusted text and caps its length. */
export function cleanText(v, max) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, '').trim().slice(0, max);
}

/** Tiny DOM builder. Text children are ALWAYS text nodes - never raw HTML - so user data can't inject markup. */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val); // CSSOM is allowed by the CSP; a style attribute is not
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list' && typeof v !== 'object') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Replaces the children of `el`; null/false are skipped (never use replaceChildren(null): it renders the text "null"). */
export function setChildren(el, ...kids) { el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false)); }

export function debounce(fn, ms) {
  let id; const d = (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(id); fn(...a); };
  return d;
}
