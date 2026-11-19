// "What is new", in the app's two languages: user-facing bullets only, newest first. docs/CHANGELOG.md is the developer copy (a unit test keeps the two in step).
export const CHANGES = [
  { v: '0.25.0',
    en: ['Share StepUp by WhatsApp, e-mail, your phone\'s share menu or a copied link, from Settings > About.', 'This "What is new" page: it opens once after an update and is always in Settings > About.'],
    he: ['שיתוף StepUp בוואטסאפ, במייל, בתפריט השיתוף של הטלפון או בהעתקת קישור: בהגדרות > אודות.', 'דף "מה חדש": נפתח פעם אחת אחרי עדכון, ותמיד זמין בהגדרות > אודות.'] },
  { v: '0.24.1',
    en: ['The installed web app now picks up a new version by itself: it loads fresh files and reloads once (never during a workout).'],
    he: ['אפליקציית הרשת המותקנת מתעדכנת עכשיו מעצמה: היא טוענת קבצים חדשים ונטענת מחדש פעם אחת (אף פעם לא באמצע אימון).'] },
  { v: '0.24.0',
    en: ['All permissions in one place in Settings, each with an Allow button, and a start-up window that asks for what is missing.', 'Map, weather and the route planner are on by default; your position is found by itself once allowed.', 'Android: "Check for updates" downloads, verifies and installs the new version as an update - your data stays.'],
    he: ['כל ההרשאות במקום אחד בהגדרות, עם כפתור "אפשר" לכל אחת, וחלונית בכניסה שמבקשת את מה שחסר.', 'המפה, מזג האוויר ומתכנן המסלולים פועלים כברירת מחדל; המיקום נמצא מעצמו אחרי שמאשרים.', 'באנדרואיד: "בדיקת עדכונים" מורידה, בודקת ומתקינה את הגרסה החדשה כעדכון - הנתונים נשארים.'] },
];
/** The entry for a version, else null. */
export const changesFor = (v) => CHANGES.find((c) => c.v === v) || null;
