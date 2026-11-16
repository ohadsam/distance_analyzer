// Applies the saved theme/direction before first paint to avoid a flash. Reads a tiny localStorage mirror (IndexedDB is async).
// Hebrew + RTL is the default; "auto" follows the browser language.
try {
  const th = localStorage.getItem('da.theme'); if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
  let lg = localStorage.getItem('da.lang') || 'he';
  if (lg === 'auto') lg = /^(he|iw)\b/i.test(navigator.language || '') ? 'he' : 'en';
  if (localStorage.getItem('da.calm') === '1') document.documentElement.dataset.calm = '1';
  const pk = localStorage.getItem('da.pack'); if (pk && /^[a-z-]{3,20}$/.test(pk) && pk !== 'momentum') document.documentElement.dataset.pack = pk;
  document.documentElement.lang = lg; document.documentElement.dir = lg === 'he' ? 'rtl' : 'ltr';
} catch { /* storage blocked: the static markup is already Hebrew/RTL */ }
