/**
 * Seeded randomness for the benchmark. Everything here is deterministic for a
 * given seed so every number the benchmark reports can be reproduced exactly.
 */

export type Rng = () => number;

/** mulberry32: small, fast, well-distributed 32-bit PRNG returning [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box-Muller. */
export function normal(rng: Rng, mean = 0, sd = 1): number {
  const u = Math.max(rng(), Number.EPSILON);
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

/**
 * Unbiased Fisher-Yates shuffle (returns a copy). The previous random baseline
 * used `sort(() => rnd() - 0.5)`, which is NOT a uniform shuffle: comparator
 * sorts give position-biased orders, so it is not a valid null model.
 */
export function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
