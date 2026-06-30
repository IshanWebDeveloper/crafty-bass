// Maps a tradesman's free-text primary trade (e.g. "Plumbing", "Electrical")
// to a practitioner noun key so the UI can call them a "Plumber" / "Electrician"
// rather than the generic "Tradesman". Matching is substring-based so minor
// wording differences still resolve; unknown trades fall back to the raw trade
// name, and a missing trade falls back to the generic label.

export type TradeRoleKey =
  | 'plumber'
  | 'electrician'
  | 'carpenter'
  | 'painter'
  | 'mason'
  | 'cleaner'
  | 'handyman'
  | 'tiler';

const MATCHERS: [RegExp, TradeRoleKey][] = [
  [/plumb/i, 'plumber'],
  [/electr/i, 'electrician'],
  [/carpent|joiner|woodwork/i, 'carpenter'],
  [/paint/i, 'painter'],
  [/mason|brick|concret|plaster/i, 'mason'],
  [/clean/i, 'cleaner'],
  [/handy/i, 'handyman'],
  [/til(e|ing)|floor/i, 'tiler'],
];

export function tradeRoleKey(
  primaryTrade: string | null | undefined,
): TradeRoleKey | null {
  if (!primaryTrade) return null;
  for (const [re, key] of MATCHERS) {
    if (re.test(primaryTrade)) return key;
  }
  return null;
}

// Maps each recognised trade role to the service-category `slug` that shares its
// colour + icon, so a tradesman's role badge picks up the same brand styling as
// the matching category chip (e.g. "Plumber" → the sky-blue plumbing wrench,
// "Electrician" → the amber electrical bolt). Unknown trades resolve to null and
// fall back to the neutral default styling.
const TRADE_ROLE_SLUGS: Record<TradeRoleKey, string> = {
  plumber: 'plumbing',
  electrician: 'electrical',
  carpenter: 'carpentry',
  painter: 'painting',
  mason: 'masonry',
  cleaner: 'cleaning',
  handyman: 'handyman',
  tiler: 'masonry',
};

/**
 * The category `slug` whose colour + icon represents a tradesman's primary
 * trade, or null when the trade isn't recognised. Pass the result to
 * `categoryMeta` / `CategoryBadge`.
 */
export function tradeRoleSlug(
  primaryTrade: string | null | undefined,
): string | null {
  const key = tradeRoleKey(primaryTrade);
  return key ? TRADE_ROLE_SLUGS[key] : null;
}

/**
 * The practitioner noun to show for a tradesman: the localized noun when the
 * trade is recognised, otherwise the raw trade name. Returns null when there's
 * no trade to show. Pass `dict.header.trades` as the labels map.
 */
export function tradeRoleLabel(
  primaryTrade: string | null | undefined,
  labels: Record<TradeRoleKey, string>,
): string | null {
  const trimmed = primaryTrade?.trim();
  if (!trimmed) return null;
  const key = tradeRoleKey(trimmed);
  return key ? labels[key] : trimmed;
}
