import { describe, it, expect } from 'vitest';
import {
  precisionAtK,
  reciprocalRank,
  dcgAtK,
  ndcgAtK,
  mean,
} from './metrics.js';

describe('ranking metrics (TC-29)', () => {
  it('precision@k divides hits by k and honours the threshold', () => {
    expect(precisionAtK([3, 0, 1], 3)).toBeCloseTo(2 / 3, 10);
    expect(precisionAtK([3, 0, 1], 2)).toBeCloseTo(1 / 2, 10);
    // grade 1 is below a threshold of 2, so only the first item counts
    expect(precisionAtK([3, 0, 1], 3, 2)).toBeCloseTo(1 / 3, 10);
    expect(precisionAtK([], 3)).toBe(0);
  });

  it('reciprocal rank is 1/rank of the first relevant item', () => {
    expect(reciprocalRank([3, 0, 1])).toBe(1); // first item relevant
    expect(reciprocalRank([0, 0, 2])).toBeCloseTo(1 / 3, 10);
    expect(reciprocalRank([0, 0, 0])).toBe(0);
  });

  it('dcg uses 2^rel-1 gain with a log2(rank+1) discount', () => {
    // [3,0,1] -> 7/log2(2) + 0/log2(3) + 1/log2(4) = 7 + 0 + 0.5 = 7.5
    expect(dcgAtK([3, 0, 1], 3)).toBeCloseTo(7.5, 10);
  });

  it('ndcg is 1 for an ideal ranking and < 1 otherwise', () => {
    expect(ndcgAtK([3, 2, 1, 0], 4)).toBe(1);
    expect(ndcgAtK([0, 1, 2, 3], 4)).toBeLessThan(1);
    // worst-first is strictly worse than best-first
    expect(ndcgAtK([0, 1, 2, 3], 4)).toBeLessThan(ndcgAtK([3, 2, 1, 0], 4));
    // no relevance to earn -> 0, not NaN
    expect(ndcgAtK([0, 0, 0], 3)).toBe(0);
  });

  it('mean macro-averages and is 0 for an empty list', () => {
    expect(mean([1, 0, 0.5])).toBeCloseTo(0.5, 10);
    expect(mean([])).toBe(0);
  });
});
