// "What is new", in the app's two languages: user-facing bullets only, newest first. docs/CHANGELOG.md is the developer copy (a unit test keeps the two in step).
export const CHANGES = [
  { v: '0.25.2',
    en: ['Steps and the steps widget now update with the app closed. A small, quiet notification keeps the step counter running; turn it off in Settings > Count my steps all day.'],
    he: ['הצעדים וווידג׳ט הצעדים מתעדכנים עכשיו גם כשהאפליקציה סגורה. התראה קטנה ושקטה שומרת על ספירת הצעדים; אפשר לכבות בהגדרות > ספירת צעדים כל היום.'] },
  { v: '0.25.1',
    en: ['The steps widget on the home screen now keeps itself up to date: a new reading every 15 minutes, when you leave the app, after a restart or an update.', 'The map credit link is easier to tap.'],
    he: ['ווידג׳ט הצעדים במסך הבית מתעדכן עכשיו מעצמו: קריאה חדשה כל 15 דקות, כשיוצאים מהאפליקציה, אחרי הפעלה מחדש ואחרי עדכון.', 'קל יותר ללחוץ על קישור הקרדיט של המפה.'] },
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
