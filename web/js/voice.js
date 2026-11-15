// Spoken cues (kilometre times and live indications) with the phone's own text-to-speech. Off by default; short sentences that wait for each other.
const LANG = { he: 'he-IL', en: 'en-US' };

/** Says `text` after whatever is being said (a backlog of more than two sentences is dropped first). Returns false when speech is not available. */
export function speak(text, lang = 'en', synth = globalThis.speechSynthesis, Utter = globalThis.SpeechSynthesisUtterance) {
  if (!synth || !Utter || typeof text !== 'string' || !text.trim()) return false;
  try { if (synth.pending) synth.cancel(); const u = new Utter(text.slice(0, 200)); u.lang = LANG[lang] || LANG.en; u.rate = 1; synth.speak(u); return true; } catch { return false; }
}
