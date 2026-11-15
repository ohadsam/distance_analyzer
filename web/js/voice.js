// Spoken cues (kilometre times and live indications) with the phone's own text-to-speech. Off by default; one short sentence at a time, never queued up.
const LANG = { he: 'he-IL', en: 'en-US' };

/** Says `text` (replacing anything still being said). Returns false when speech is not available. */
export function speak(text, lang = 'en', synth = globalThis.speechSynthesis, Utter = globalThis.SpeechSynthesisUtterance) {
  if (!synth || !Utter || typeof text !== 'string' || !text.trim()) return false;
  try { synth.cancel(); const u = new Utter(text.slice(0, 200)); u.lang = LANG[lang] || LANG.en; u.rate = 1; synth.speak(u); return true; } catch { return false; }
}
