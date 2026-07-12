/**
 * Tunable constants for the tradesman recommendation score.
 *
 * The four factors (reputation, proximity, completion, response) are each
 * squeezed to a 0-1 sub-score and blended by weight; a small boost rewards
 * verified tradesmen. Formulas are documented in
 * docs/recommendation-scoring-panel2-formulas.svg. These are pure data - the
 * scoring functions in this folder read them, so tuning happens in one place.
 */
export const SCORING_CONFIG = {
  // Must sum to 1 (asserted in tests).
  weights: {
    reputation: 0.35,
    proximity: 0.3,
    completion: 0.2,
    response: 0.15,
  },
  // Bayesian prior (m, C) + exponential recency decay (half-life H, in days).
  reputation: {
    priorMean: 4.0,
    priorCount: 5,
    halfLifeDays: 180,
  },
  // Bayesian-smoothed completion rate over a rolling window.
  completion: {
    priorRate: 0.9,
    priorCount: 5,
    windowDays: 90,
  },
  // Median reply time normalised between a "good" target and a "poor" ceiling
  // (minutes); tradesmen with no measured replies get a neutral score.
  response: {
    targetMinutes: 30,
    poorMinutes: 1440,
    missingScore: 0.5,
  },
  // Additive bonus for a verified tradesman, applied before the final cap at 1.
  verifiedBoost: 0.05,
} as const;

/** Keep a value inside [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
