import { EN, HE } from './strings02.js';
import { EN as EN3, HE as HE3 } from './strings03.js';
import { EN as EN4, HE as HE4 } from './strings04.js';
// Hebrew + English. `t(key, params)` looks up the active language, falls back to English, then to the key.
// Layout uses CSS logical properties, so flipping <html dir> is all RTL needs. Every key must exist in BOTH languages (unit test).
export const STR = {
  en: {
    appName: 'StepUp', home: 'Home', settings: 'Settings', history: 'History', back: 'Back', version: 'Version {v}',
    hello: 'Ready to move?', helloHint: 'Pick an activity and press start.', walk: 'Walk', run: 'Run', startWalk: 'Start a walk', startRun: 'Start a run',
    resumeTitle: 'Workout in progress', resumeBtn: 'Continue', discard: 'Discard', recent: 'Recent', noWorkouts: 'No workouts yet. Your first one will appear here.', allHistory: 'All workouts',
    km: 'km', perKm: '/km', min: 'min', time: 'Time', distance: 'Distance', pace: 'Pace', avgPace: 'Average pace', kcal: 'Energy', kcalUnit: 'kcal', splits: 'Each kilometre', splitKm: 'Km {n}',
    start: 'Start', pause: 'Pause', resume: 'Resume', finish: 'Finish', keepGoing: 'Keep going', saveFinish: 'Finish and save', finishAsk: 'Finish this workout?', done: 'Done',
    gpsSearching: 'Looking for GPS…', gpsGood: 'GPS ready', gpsWeak: 'GPS weak', gpsDenied: 'Location is off. Allow it to measure distance.', gpsMissing: 'This device cannot give a location.',
    lock: 'Lock screen', unlock: 'Hold to unlock', locked: 'Locked', paused: 'Paused', summary: 'Workout complete', deleteIt: 'Delete', confirmDelete: 'Delete this workout?',
    metro: 'Rhythm', metroOff: 'Rhythm coach off', metroListen: 'Listening to your pace…', metroLocked: '{bpm} steps/min', metroOn: 'Rhythm coach on',
    metroNoSensor: 'No motion sensor. Set your rhythm by hand.', metroSlower: 'a little slower', metroFaster: 'a little faster', metroSteady: 'on rhythm', metroLess: 'Slower', metroMore: 'Faster',
    breatheIn: 'Breathe in', breatheOut: 'Breathe out', steps: 'steps/min',
    language: 'Language', theme: 'Theme', themeAuto: 'Automatic', themeLight: 'Light', themeDark: 'Dark', look: 'Look', weight: 'Weight (for energy)', kg: 'kg',
    metroSection: 'Rhythm coach', volume: 'Click volume', breath: 'Breathing pattern', breathOff: 'No breathing guide', breath32: 'In 3 steps, out 2 (default)', breath22: 'In 2 steps, out 2 (easy)', breath21: 'In 2 steps, out 1 (fast)',
    defaultBpm: 'Rhythm if no sensor', packMomentum: 'Momentum', packOcean: 'Ocean', packForest: 'Forest', packSunset: 'Sunset', packViolet: 'Violet', packSlate: 'Slate', packMono: 'Mono', packHigh: 'High contrast',
    movingTime: 'Moving time', replaceAsk: 'A workout is still in progress. Discard it and start a new one?', discardAsk: 'Discard the workout in progress?', tooShort: 'Too short to save',
    stepsNote: 'Distance comes from GPS and is an estimate. General guidance only, not medical advice.',
  },
  he: {
    appName: 'StepUp', home: 'בית', settings: 'הגדרות', history: 'היסטוריה', back: 'חזרה', version: 'גרסה {v}',
    hello: 'מוכנים לזוז?', helloHint: 'בחרו פעילות ולחצו התחל.', walk: 'הליכה', run: 'ריצה', startWalk: 'התחלת הליכה', startRun: 'התחלת ריצה',
    resumeTitle: 'אימון בתהליך', resumeBtn: 'המשך', discard: 'ביטול', recent: 'אחרונים', noWorkouts: 'עדיין אין אימונים. הראשון יופיע כאן.', allHistory: 'כל האימונים',
    km: 'ק״מ', perKm: '/ק״מ', min: 'דק׳', time: 'זמן', distance: 'מרחק', pace: 'קצב', avgPace: 'קצב ממוצע', kcal: 'אנרגיה', kcalUnit: 'קק״ל', splits: 'כל קילומטר', splitKm: 'ק״מ {n}',
    start: 'התחל', pause: 'השהה', resume: 'המשך', finish: 'סיום', keepGoing: 'ממשיכים', saveFinish: 'סיום ושמירה', finishAsk: 'לסיים את האימון?', done: 'סיימתי',
    gpsSearching: 'מחפש אות GPS…', gpsGood: 'GPS מוכן', gpsWeak: 'אות GPS חלש', gpsDenied: 'המיקום כבוי. אשרו אותו כדי למדוד מרחק.', gpsMissing: 'במכשיר הזה אי אפשר לקבל מיקום.',
    lock: 'נעילת מסך', unlock: 'החזיקו לפתיחה', locked: 'נעול', paused: 'מושהה', summary: 'האימון הסתיים', deleteIt: 'מחיקה', confirmDelete: 'למחוק את האימון?',
    metro: 'קצב', metroOff: 'מאמן הקצב כבוי', metroListen: 'מקשיב לקצב שלך…', metroLocked: '{bpm} צעדים/דק׳', metroOn: 'מאמן הקצב פועל',
    metroNoSensor: 'אין חיישן תנועה. קבעו את הקצב ידנית.', metroSlower: 'קצת לאט יותר', metroFaster: 'קצת מהר יותר', metroSteady: 'בקצב', metroLess: 'לאט יותר', metroMore: 'מהר יותר',
    breatheIn: 'שאיפה', breatheOut: 'נשיפה', steps: 'צעדים/דק׳',
    language: 'שפה', theme: 'מצב תצוגה', themeAuto: 'אוטומטי', themeLight: 'בהיר', themeDark: 'כהה', look: 'מראה', weight: 'משקל (לחישוב אנרגיה)', kg: 'ק״ג',
    metroSection: 'מאמן קצב', volume: 'עוצמת הנקישה', breath: 'דפוס נשימה', breathOff: 'בלי הנחיית נשימה', breath32: 'שאיפה 3 צעדים, נשיפה 2 (ברירת מחדל)', breath22: 'שאיפה 2 צעדים, נשיפה 2 (קל)', breath21: 'שאיפה 2 צעדים, נשיפה 1 (מהיר)',
    defaultBpm: 'קצב כשאין חיישן', packMomentum: 'מומנטום', packOcean: 'אוקיינוס', packForest: 'יער', packSunset: 'שקיעה', packViolet: 'סגול', packSlate: 'צפחה', packMono: 'מונו', packHigh: 'ניגודיות גבוהה',
    movingTime: 'זמן תנועה', replaceAsk: 'יש אימון בתהליך. לבטל אותו ולהתחיל חדש?', discardAsk: 'לבטל את האימון שבתהליך?', tooShort: 'קצר מדי לשמירה',
    stepsNote: 'המרחק נמדד ב-GPS והוא הערכה. הכוונה כללית בלבד, לא ייעוץ רפואי.',
  },
};

Object.assign(STR.en, EN, EN3, EN4); Object.assign(STR.he, HE, HE3, HE4);

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
