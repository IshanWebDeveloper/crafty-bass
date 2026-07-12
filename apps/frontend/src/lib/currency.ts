// Crafty Bass prices in Sri Lankan Rupees (LKR) with grouped thousands.
// Render amounts in the mono font at the call site (e.g. `font-mono`).

const CURRENCY = 'LKR';

/** Format a number as `"LKR 16,500"` (grouped thousands, no decimals). */
export function formatLKR(amount: number, currency = CURRENCY): string {
  return `${currency} ${Math.round(amount).toLocaleString('en-US')}`;
}

/** Format a min/max budget range, tolerating an open-ended end:
 *  both → `"LKR 12,000 - 20,000"`, min only → `"LKR 12,000+"`,
 *  max only → `"Up to LKR 20,000"`. */
export function formatBudgetRange(
  min?: number | null,
  max?: number | null,
  currency = CURRENCY,
): string {
  const has = (n?: number | null): n is number => n != null && !Number.isNaN(n);
  if (has(min) && has(max)) {
    return `${currency} ${min.toLocaleString('en-US')} - ${max.toLocaleString('en-US')}`;
  }
  if (has(min)) return `${formatLKR(min, currency)}+`;
  if (has(max)) return `Up to ${formatLKR(max, currency)}`;
  return '';
}
