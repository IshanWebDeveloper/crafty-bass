import { describe, it, expect } from 'vitest';
import {
  SCORING_CONFIG,
  haversineKm,
  proximityScore,
  reputationScore,
  completionScore,
  responseScore,
  compositeScore,
} from './index.js';

const COLOMBO = { lat: 6.9271, lng: 79.8612 };
const KANDY = { lat: 7.2906, lng: 80.6337 };

describe('scoring config', () => {
  it('weights sum to 1', () => {
    const w = SCORING_CONFIG.weights;
    expect(w.reputation + w.proximity + w.completion + w.response).toBeCloseTo(
      1,
      10,
    );
  });
});

describe('proximity', () => {
  it('measures Colombo → Kandy at ≈ 94 km', () => {
    expect(haversineKm(COLOMBO, KANDY)).toBeGreaterThan(90);
    expect(haversineKm(COLOMBO, KANDY)).toBeLessThan(98);
  });

  it('scores identical coordinates as 1', () => {
    expect(proximityScore(COLOMBO, { ...COLOMBO }, 10)).toBe(1);
  });

  it('scores 0 at or beyond the radius', () => {
    const d = haversineKm(COLOMBO, KANDY);
    expect(proximityScore(COLOMBO, KANDY, d / 2)).toBe(0);
  });

  it('scores 0.5 at half the radius', () => {
    const d = haversineKm(COLOMBO, KANDY);
    expect(proximityScore(COLOMBO, KANDY, d * 2)).toBeCloseTo(0.5, 10);
  });

  it('scores 0 for missing coordinates or a non-positive radius', () => {
    expect(proximityScore(null, KANDY, 10)).toBe(0);
    expect(proximityScore(COLOMBO, null, 10)).toBe(0);
    expect(proximityScore(COLOMBO, KANDY, 0)).toBe(0);
  });
});

describe('reputation', () => {
  const prior = (SCORING_CONFIG.reputation.priorMean - 1) / 4;

  it('collapses to the prior mean with no reviews', () => {
    expect(reputationScore([])).toBeCloseTo(prior, 10);
  });

  it('weights recent reviews more than old ones (recency damping)', () => {
    const recent = reputationScore([{ rating: 5, ageDays: 0 }]);
    const old = reputationScore([{ rating: 5, ageDays: 3600 }]);
    expect(recent).toBeGreaterThan(old);
    // A very old 5-star barely moves the score off the prior.
    expect(old).toBeCloseTo(prior, 2);
  });

  it('is monotone in rating', () => {
    const high = reputationScore([{ rating: 5, ageDays: 0 }]);
    const low = reputationScore([{ rating: 2, ageDays: 0 }]);
    expect(high).toBeGreaterThan(low);
  });
});

describe('completion', () => {
  it('collapses to the prior rate with no history', () => {
    expect(completionScore({ completed: 0, cancelled: 0 })).toBeCloseTo(
      SCORING_CONFIG.completion.priorRate,
      10,
    );
  });

  it('is reduced by cancellations', () => {
    const clean = completionScore({ completed: 10, cancelled: 0 });
    const flaky = completionScore({ completed: 10, cancelled: 10 });
    expect(flaky).toBeLessThan(clean);
  });

  it('stays within [0, 1]', () => {
    const s = completionScore({ completed: 3, cancelled: 40 });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('response', () => {
  const { targetMinutes, poorMinutes, missingScore } = SCORING_CONFIG.response;

  it('scores 1 at or below the target', () => {
    expect(responseScore(targetMinutes)).toBe(1);
    expect(responseScore(1)).toBe(1);
  });

  it('scores 0 at the poor ceiling', () => {
    expect(responseScore(poorMinutes)).toBeCloseTo(0, 10);
  });

  it('scores 0.5 at the midpoint', () => {
    expect(responseScore((targetMinutes + poorMinutes) / 2)).toBeCloseTo(
      0.5,
      10,
    );
  });

  it('returns the neutral score for a missing median', () => {
    expect(responseScore(null)).toBe(missingScore);
  });
});

describe('composite', () => {
  it('caps a perfect verified tradesman at 1', () => {
    const { score } = compositeScore({
      reputation: 1,
      proximity: 1,
      completion: 1,
      response: 1,
      verified: true,
    });
    expect(score).toBe(1);
  });

  it('adds the verified boost below the cap', () => {
    const { score, boost } = compositeScore({
      reputation: 0.9,
      proximity: 0.9,
      completion: 0.9,
      response: 0.9,
      verified: true,
    });
    expect(boost).toBe(SCORING_CONFIG.verifiedBoost);
    expect(score).toBeCloseTo(0.95, 10);
  });

  it('breakdown sums to the score when unboosted and uncapped', () => {
    const result = compositeScore({
      reputation: 0.5,
      proximity: 0.5,
      completion: 0.5,
      response: 0.5,
      verified: false,
    });
    const sum =
      result.breakdown.reputation +
      result.breakdown.proximity +
      result.breakdown.completion +
      result.breakdown.response;
    expect(sum).toBeCloseTo(result.score, 10);
    expect(result.score).toBeCloseTo(0.5, 10);
  });

  it('is deterministic for the same input', () => {
    const input = {
      reputation: 0.8,
      proximity: 0.6,
      completion: 0.7,
      response: 0.4,
      verified: true,
    };
    expect(compositeScore(input)).toEqual(compositeScore(input));
  });
});

describe('composite weights override', () => {
  const input = {
    reputation: 1,
    proximity: 0,
    completion: 0,
    response: 0,
    verified: false,
  };
  it('uses the production weights by default', () => {
    expect(compositeScore(input).score).toBeCloseTo(
      SCORING_CONFIG.weights.reputation,
      10,
    );
  });
  it('accepts explicit weights (used only by the benchmark sweep)', () => {
    const w = {
      reputation: 0.5,
      proximity: 0.2,
      completion: 0.2,
      response: 0.1,
    };
    expect(compositeScore(input, w).score).toBeCloseTo(0.5, 10);
  });
});
