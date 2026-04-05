/** Copy text to clipboard with fallback for HTTP context (no secure context) */
export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback: textarea + execCommand (works on HTTP / non-secure context)
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch {
      document.body.removeChild(ta);
      reject(new Error('Copy not supported'));
    }
  });
}
