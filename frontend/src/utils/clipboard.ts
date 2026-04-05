/** Copy text to clipboard with fallback for HTTP context (no secure context) */
export function copyToClipboard(text: string): Promise<void> {
  // navigator.clipboard only works on HTTPS or localhost
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
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
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) resolve();
    else reject(new Error('Copy không được hỗ trợ trên trình duyệt này'));
  });
}
