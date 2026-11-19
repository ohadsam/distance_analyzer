// Sharing the APP itself (never data): the one text with both links, turned into a WhatsApp link and an e-mail link. Pure - the sheet and the tests use it.
export const enc = encodeURIComponent;
/** { whatsapp, mail } for a share text; plain https / mailto URLs, everything percent-encoded. */
export function shareLinks(text, subject = 'StepUp') {
  const body = String(text).slice(0, 600);
  return { whatsapp: `https://wa.me/?text=${enc(body)}`, mail: `mailto:?subject=${enc(subject)}&body=${enc(body)}` };
}
