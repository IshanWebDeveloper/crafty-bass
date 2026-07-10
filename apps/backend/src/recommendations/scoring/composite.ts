import { SCORING_CONFIG, clamp } from './config.js';

/** The four sub-scores (each already in [0, 1]) plus verification status. */
export interface CompositeInput {
  reputation: number;
  proximity: number;
  completion: number;
  response: number;
  verified: boolean;
}

/** Weighted contribution of each factor to the final score. */
export interface ScoreBreakdown {
  reputation: number;
  proximity: number;
  completion: number;
  response: number;
}

export interface CompositeResult {
  score: number;
  breakdown: ScoreBreakdown;
  boost: number;
}

/**
 * Blend the four sub-scores by weight, add the verified boost, and cap at 1:
 *
 *   score = 0.35·rep + 0.30·prox + 0.20·comp + 0.15·resp (+ boost, capped at 1)
 *
 * The breakdown is each factor's weighted contribution (it sums to the score
 * when no boost is applied and the cap doesn't bite).
 */
export function compositeScore(input: CompositeInput): CompositeResult {
  const w = SCORING_CONFIG.weights;
  const breakdown: ScoreBreakdown = {
    reputation: w.reputation * input.reputation,
    proximity: w.proximity * input.proximity,
    completion: w.completion * input.completion,
    response: w.response * input.response,
  };
  const base =
    breakdown.reputation +
    breakdown.proximity +
    breakdown.completion +
    breakdown.response;
  const boost = input.verified ? SCORING_CONFIG.verifiedBoost : 0;
  return {
    score: clamp(base + boost, 0, 1),
    breakdown,
    boost,
  };
}
