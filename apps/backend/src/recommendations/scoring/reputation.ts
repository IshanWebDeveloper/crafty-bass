import { SCORING_CONFIG, clamp } from './config.js';

/**
 * A review reduced to what scoring needs: its star rating (1-5) and how old it
 * is in days. Keeping it clock-free (ageDays already computed) makes the score
 * a pure function - the DB/query layer decides "now".
 */
export interface WeightedReview {
  rating: number;
  ageDays: number;
}

/**
 * Reputation sub-score in [0, 1]. Recent reviews weigh more (exponential decay
 * with half-life H); a Bayesian prior (m, C) steadies sparse histories so a
 * newcomer scores as an average tradesman rather than a zero.
 *
 *   wᵢ = 0.5 ^ (ageᵢ / H)
 *   R  = (C·m + Σ wᵢ·ratingᵢ) / (C + Σ wᵢ)
 *   score = (R − 1) / 4
 */
export function reputationScore(reviews: WeightedReview[]): number {
  const { priorMean, priorCount, halfLifeDays } = SCORING_CONFIG.reputation;
  let sumW = 0;
  let sumWR = 0;
  for (const { rating, ageDays } of reviews) {
    const w = Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays);
    sumW += w;
    sumWR += w * rating;
  }
  const R = (priorCount * priorMean + sumWR) / (priorCount + sumW);
  return clamp((R - 1) / 4, 0, 1);
}
