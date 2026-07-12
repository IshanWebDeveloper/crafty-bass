/**
 * Escapes a value for safe interpolation into HTML text/attribute content inside
 * transactional emails. A tiny, dependency-free encoder - not a sanitiser.
 * Everything is encoded as data; non-string inputs coerce to ''.
 */
export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}
