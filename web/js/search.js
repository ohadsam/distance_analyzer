// Pure global search: normalisation (Hebrew + English), indexing and ranking. The UI builds the items (settings, screens, workouts, alerts...).
// An item is { id, type, title, text, href }: `title` is shown, `text` holds extra searchable words (any language).
const NIQQUD = /[֑-ׇ]/g, FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

/** Lower-case, no vowel marks, no punctuation, final letters unified, ״ ׳ quotes removed (ק״מ == קמ == km handled by the item text). */
export function normalize(s) {
  return String(s ?? '').toLowerCase().replace(NIQQUD, '').replace(/[ךםןףץ]/g, (c) => FINAL[c]).replace(/[״"׳'`´]/g, '').replace(/[,;:!?()[\]{}\/\\|_-]+/g, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildIndex(items) {
  return items.map((it) => ({ it, title: normalize(it.title), text: normalize(it.text || '') }));
}

/** Every query word must appear (as a word prefix or inside a word). Title hits outrank text hits; prefix hits outrank inner hits. */
export function search(index, query, limit = 30) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const e of index) {
    let score = 0, ok = true;
    for (const w of words) {
      const tw = e.title.split(' '), xw = e.text.split(' ');
      if (tw.some((x) => x === w)) score += 12; else if (tw.some((x) => x.startsWith(w))) score += 9; else if (e.title.includes(w)) score += 6;
      else if (xw.some((x) => x === w)) score += 5; else if (xw.some((x) => x.startsWith(w))) score += 4; else if (e.text.includes(w)) score += 2;
      else { ok = false; break; }
    }
    if (ok) out.push({ it: e.it, score });
  }
  return out.sort((a, b) => b.score - a.score || (b.it.ts || 0) - (a.it.ts || 0)).slice(0, limit).map((x) => x.it);
}
