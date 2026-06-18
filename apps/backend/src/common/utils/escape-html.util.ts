/**
 * Escapes a value for safe interpolation into HTML text content / attribute
 * values inside transactional emails. This is intentionally a tiny, dependency-
 * free encoder — not a sanitiser. Callers must NOT pass HTML they want
 * preserved; everything is encoded as data.
 *
 * Non-string inputs (null / undefined / numbers) are coerced to a string first
 * so template authors don't have to remember to coalesce.
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
