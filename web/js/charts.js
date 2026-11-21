// Small SVG charts (no library; they animate in when drawn - bars grow, the line draws itself - see app.css, still in calm mode): bars with an optional target line, and a line. Drawn with createElementNS, scaled to the viewBox; the numbers
// are always also available as text next to the chart, so the picture is decorative (aria-hidden).
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'idx') e.style.setProperty('--i', String(v)); else e.setAttribute(k, v); } parent?.append(e); return e; }; // (idx -> the animation delay variable, set through the style object: the CSP forbids style attributes)

/**
 * Tapping: with `onPick(i)` every bar / point gets a transparent column that picks it (mouse and touch); with `labels` (one text per bar) the columns are also keyboard buttons
 * (Tab, Enter or Space) and the chart is no longer hidden from assistive technology. The chart gets `select(i)` to mark a bar / point from outside (class `sel`).
 */
function picking(svg, count, area, { onPick, labels, sel, title }) {
  if (!onPick) return;
  const hits = [], focusable = Array.isArray(labels) && labels.length === count;
  if (focusable) { svg.removeAttribute('aria-hidden'); svg.setAttribute('role', 'group'); if (title) svg.setAttribute('aria-label', title); }
  for (let i = 0; i < count; i++) {
    const [x, width] = area(i), hit = mk('rect', { x: x.toFixed(1), y: 0, width: width.toFixed(1), height: svg.viewBox.baseVal.height, class: 'hit' }, svg), pick = () => { svg.select(i); onPick(i); };
    hit.addEventListener('click', pick);
    if (focusable) { hit.setAttribute('role', 'button'); hit.setAttribute('tabindex', '0'); hit.setAttribute('aria-label', labels[i]); hit.setAttribute('aria-pressed', 'false'); hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }); }
    hits.push(hit);
  }
  svg.hits = hits; if (sel != null) svg.select(sel);
}

/** bars: [{ v, label, cls }]; opts: { target, w, h, onPick, labels, sel, title }. */
export function barChart(bars, { target = 0, w = 300, h = 110, onPick, labels, sel, title } = {}) {
  const svg = mk('svg', { viewBox: `0 0 ${w} ${h}`, class: 'chart', 'aria-hidden': 'true', focusable: 'false' }), rects = [];
  const max = Math.max(1, target, ...bars.map((b) => b.v)), pad = 14, bw = (w - pad * 2) / Math.max(1, bars.length), top = 8, base = h - 18;
  for (const f of [0.33, 0.66]) mk('line', { x1: pad, x2: w - pad, y1: (base - f * (base - top)).toFixed(1), y2: (base - f * (base - top)).toFixed(1), class: 'grid' }, svg); // faint guides (design kit: grid at 22 % outline)
  mk('line', { x1: pad, x2: w - pad, y1: base, y2: base, class: 'axis' }, svg);
  bars.forEach((b, i) => {
    const bh = (b.v / max) * (base - top), x = pad + i * bw + bw * 0.15;
    rects.push(mk('rect', { x: x.toFixed(1), y: (base - bh).toFixed(1), width: (bw * 0.7).toFixed(1), height: Math.max(b.v > 0 ? 2 : 0, bh).toFixed(1), rx: 5, class: `bar ${b.cls || ''}`, idx: i }, svg));
    if (b.cls?.includes('now')) mk('circle', { cx: (x + bw * 0.35).toFixed(1), cy: Math.max(4, base - bh - 6).toFixed(1), r: 3.5, class: 'nowdot' }, svg); // the current period is marked by a dot too, not only by colour
    if (b.label) mk('text', { x: (x + bw * 0.35).toFixed(1), y: h - 4, class: 'lbl', 'text-anchor': 'middle' }, svg).textContent = b.label;
  });
  if (target > 0) { const y = base - (target / max) * (base - top); mk('line', { x1: pad, x2: w - pad, y1: y.toFixed(1), y2: y.toFixed(1), class: 'target' }, svg); }
  svg.select = (i) => { rects.forEach((r, k) => r.classList.toggle('sel', k === i)); svg.hits?.forEach((x, k) => x.setAttribute('aria-pressed', String(k === i))); };
  picking(svg, bars.length, (i) => [pad + i * bw, bw], { onPick, labels, sel, title });
  return svg;
}

/** points: [number] (null = gap); lower is better is the caller's business. opts: { w, h, onPick, labels, sel, title } (see above). */
export function lineChart(values, { w = 300, h = 90, onPick, labels, sel, title } = {}) {
  const svg = mk('svg', { viewBox: `0 0 ${w} ${h}`, class: 'chart', 'aria-hidden': 'true', focusable: 'false' }), dots = [];
  const v = values.filter((x) => Number.isFinite(x)); if (v.length < 2) return svg;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1, pad = 10, step = (w - 2 * pad) / (values.length - 1);
  const pts = values.map((x, i) => (Number.isFinite(x) ? [pad + i * step, pad + (1 - (x - lo) / span) * (h - 2 * pad)] : null)).filter(Boolean);
  mk('polyline', { pathLength: 1, points: pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' '), class: 'line' }, svg);
  pts.forEach((p, i) => dots.push(mk('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 4, class: 'dot', idx: i }, svg)));
  const mark = mk('line', { x1: 0, x2: 0, y1: 2, y2: h - 2, class: 'selline', visibility: 'hidden' }, svg); // (the picked hour: a thin vertical line and a bigger dot)
  svg.select = (i) => { dots.forEach((d, k) => d.classList.toggle('sel', k === i)); svg.hits?.forEach((x, k) => x.setAttribute('aria-pressed', String(k === i))); const p = pts[i]; if (p) { mark.setAttribute('x1', p[0].toFixed(1)); mark.setAttribute('x2', p[0].toFixed(1)); mark.setAttribute('visibility', 'visible'); } };
  picking(svg, pts.length, (i) => [pts[i][0] - step / 2, step], { onPick, labels, sel, title });
  return svg;
}
