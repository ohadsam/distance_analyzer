// Hebrew + English. `t(key, params)` looks up the active language, falls back to English, then to the key.
// Layout uses CSS logical properties, so flipping <html dir> is all RTL needs. Every key must exist in BOTH languages (unit test).
export const STR = {
  en: {
    appName: 'Distance Analyzer', home: 'Home', settings: 'Settings', language: 'Language', theme: 'Theme',
    themeAuto: 'Automatic', themeLight: 'Light', themeDark: 'Dark', hello: 'Welcome', helloHint: 'This screen is a starting point.',
    version: 'Version {v}', back: 'Back',
  },
  he: {
    appName: 'מנתח מרחקים', home: 'בית', settings: 'הגדרות', language: 'שפה', theme: 'מראה',
    themeAuto: 'אוטומטי', themeLight: 'בהיר', themeDark: 'כהה', hello: 'ברוכים הבאים', helloHint: 'המסך הזה הוא נקודת פתיחה.',
    version: 'גרסה {v}', back: 'חזרה',
  },
};

let lang = 'he';
export const getLang = () => lang;
export const isRtl = () => lang === 'he';

export function resolveLang(pref, navLang = globalThis.navigator?.language || 'en') {
  if (pref === 'he' || pref === 'en') return pref;
  return /^(he|iw)\b/i.test(navLang) ? 'he' : 'en';
}

export function setLang(pref) {
  lang = resolveLang(pref);
  if (globalThis.document) { document.documentElement.lang = lang; document.documentElement.dir = isRtl() ? 'rtl' : 'ltr'; }
  return lang;
}

export function t(key, params = {}) {
  const s = STR[lang]?.[key] ?? STR.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}
