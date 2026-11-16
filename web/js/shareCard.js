// Hands a finished card (canvas) to the person: Android's share sheet, the browser's share sheet, or a download. Encodes once, never throws.
import { h } from './util.js';
import { native } from './native.js';

/** Returns '' on success (or when the person cancelled), else an error key for the caller to show. */
export async function shareCanvas(cv, fileName = 'stepup.png') {
  try {
    if (native.available) { const b64 = cv.toDataURL('image/png').split(',')[1]; return b64 && native.shareImage(b64) ? '' : 'rcdShareError'; }
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png')); if (!blob) return 'rcdShareError';
    const f = new File([blob], fileName, { type: 'image/png' });
    try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: 'StepUp' }); return ''; } } catch (e) { if (e?.name === 'AbortError') return ''; }
    const a = h('a', { href: URL.createObjectURL(blob), download: fileName }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return '';
  } catch { return 'rcdShareError'; }
}
