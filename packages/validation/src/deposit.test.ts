import { describe, it, expect } from 'vitest';
import { depositTier, maxDeposit, TradesmanTrust } from './index';

describe('depositTier', () => {
  it('returns none for unverified', () => {
    const trust: TradesmanTrust = {
      verified: false,
      rating: 5,
      completed: 100,
      bgChecked: true,
    };
    const tier = depositTier(trust);
    expect(tier.key).toBe('none');
    expect(tier.pct).toBe(0);
    expect(tier.cap).toBe(0);
  });

  it('returns verified with 20% and 15000 cap', () => {
    const trust: TradesmanTrust = {
      verified: true,
      rating: 0,
      completed: 0,
      bgChecked: false,
    };
    const tier = depositTier(trust);
    expect(tier.key).toBe('verified');
    expect(tier.pct).toBe(20);
    expect(tier.cap).toBe(15000);
  });

  it('handles trusted boundary (4.5 & 20 vs 4.49/19)', () => {
    const trusted: TradesmanTrust = {
      verified: true,
      rating: 4.5,
      completed: 20,
      bgChecked: false,
    };
    expect(depositTier(trusted).key).toBe('trusted');
    expect(depositTier(trusted).pct).toBe(30);
    expect(depositTier(trusted).cap).toBe(40000);

    const almostRating: TradesmanTrust = {
      verified: true,
      rating: 4.49,
      completed: 20,
      bgChecked: false,
    };
    expect(depositTier(almostRating).key).toBe('verified');

    const almostCompleted: TradesmanTrust = {
      verified: true,
      rating: 4.5,
      completed: 19,
      bgChecked: false,
    };
    expect(depositTier(almostCompleted).key).toBe('verified');
  });

  it('handles background boundary (bgChecked & 4.7 & 50)', () => {
    const bg: TradesmanTrust = {
      verified: true,
      rating: 4.7,
      completed: 50,
      bgChecked: true,
    };
    expect(depositTier(bg).key).toBe('background');
    expect(depositTier(bg).pct).toBe(40);
    expect(depositTier(bg).cap).toBe(75000);

    const noBg: TradesmanTrust = {
      verified: true,
      rating: 4.7,
      completed: 50,
      bgChecked: false,
    };
    expect(depositTier(noBg).key).toBe('trusted');

    const almostRating: TradesmanTrust = {
      verified: true,
      rating: 4.69,
      completed: 50,
      bgChecked: true,
    };
    expect(depositTier(almostRating).key).toBe('trusted');
  });
});

describe('maxDeposit', () => {
  const verifiedTrust: TradesmanTrust = {
    verified: true,
    rating: 0,
    completed: 0,
    bgChecked: false,
  }; // pct: 20, cap: 15000

  it('caps by tier cap', () => {
    // 20% of 100,000 = 20,000, which is > 15,000 cap
    const max = maxDeposit(verifiedTrust, 100000, 100000);
    expect(max).toBe(15000);
  });

  it('caps by materialsAmount', () => {
    // 20% of 50,000 = 10,000, which is < 15,000 cap, but materials is only 5,000
    const max = maxDeposit(verifiedTrust, 50000, 5000);
    expect(max).toBe(5000);
  });

  it('never returns a negative amount', () => {
    const max = maxDeposit(verifiedTrust, -100, -500);
    expect(max).toBe(0);
  });

  it('returns 0 for unverified', () => {
    const unverified: TradesmanTrust = {
      verified: false,
      rating: 5,
      completed: 100,
      bgChecked: true,
    };
    const max = maxDeposit(unverified, 100000, 100000);
    expect(max).toBe(0);
  });
});
