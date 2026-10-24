import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SCORING_CONFIG } from '../index.js';
import { runBenchmark, type BenchmarkDataset } from './benchmark.js';
import { mulberry32, shuffle } from './random.js';
import { PREFERENCE_PROFILES, simulateDataset } from './simulate.js';
import { weightGrid } from './sweep.js';

const balanced = PREFERENCE_PROFILES.find((p) => p.name === 'balanced')!;

describe('benchmark randomness', () => {
  it('shuffle is a permutation and is reproducible for a seed', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    const a = shuffle(mulberry32(42), xs);
    const b = shuffle(mulberry32(42), xs);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(xs);
    expect(a).not.toEqual(xs);
  });

  it('shuffle is unbiased: each item lands first about 1/n of the time', () => {
    const rng = mulberry32(7);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) counts[shuffle(rng, [0, 1, 2, 3])[0]]++;
    for (const c of counts) expect(c / 40_000).toBeCloseTo(0.25, 1);
  });
});

describe('latent-truth simulation', () => {
  const ds = simulateDataset({ seed: 7, jobs: 60, profile: balanced });

  it('is deterministic for a given seed', () => {
    expect(simulateDataset({ seed: 7, jobs: 60, profile: balanced })).toEqual(
      ds,
    );
  });

  it('labels every kept job with at most one grade-3 and some relevant candidate', () => {
    expect(ds.jobs.length).toBeGreaterThan(50);
    for (const job of ds.jobs) {
      expect(job.candidates.length).toBe(20);
      expect(job.candidates.filter((c) => c.relevance === 3).length).toBe(1);
      expect(job.candidates.some((c) => c.relevance > 0)).toBe(true);
    }
  });

  it('includes cold-start tradesmen with no reviews', () => {
    const all = ds.jobs.flatMap((j) => j.candidates);
    expect(all.some((c) => c.reviews.length === 0)).toBe(true);
  });
});

describe('recommendation ranking benchmark (TC-18) on simulated data', () => {
  const report = runBenchmark(
    simulateDataset({ seed: 11, jobs: 120, profile: balanced }),
    {
      randomRepeats: 50,
      bootstrapSamples: 500,
    },
  );
  const by = (s: string) => report.results.find((r) => r.strategy === s)!;

  it('the composite ranker beats the random baseline, with a CI that excludes 0', () => {
    expect(by('composite').ndcgAtK).toBeGreaterThan(by('random').ndcgAtK);
    const vsRandom = report.comparisons.find((c) => c.baseline === 'random')!;
    expect(vsRandom.ci95[0]).toBeGreaterThan(0);
  });

  it('the composite ranker beats every single-factor baseline on nDCG@k', () => {
    for (const s of ['reputationOnly', 'naiveAverageRating', 'proximityOnly']) {
      expect(by('composite').ndcgAtK).toBeGreaterThan(by(s).ndcgAtK);
    }
  });

  it('the random baseline matches its analytic expectation for precision@k', () => {
    // 6 relevant of 20 candidates -> expected precision@5 = 6/20.
    expect(by('random').precisionAtK).toBeCloseTo(6 / 20, 1);
  });

  it('reports cold-start exposure for every strategy', () => {
    expect(report.coldStart.byStrategy.map((s) => s.strategy)).toContain(
      'composite',
    );
    expect(report.coldStart.poolShare).toBeGreaterThan(0);
  });
});

describe('weight sweep grid', () => {
  const grid = weightGrid();
  it('enumerates every 0.05-step vector with each weight >= 0.05 (969 vectors)', () => {
    expect(grid.length).toBe(969);
    for (const w of grid) {
      expect(
        w.reputation + w.proximity + w.completion + w.response,
      ).toBeCloseTo(1, 9);
    }
  });
  it('contains the production weights', () => {
    const p = SCORING_CONFIG.weights;
    expect(
      grid.some((w) =>
        (Object.keys(p) as (keyof typeof p)[]).every(
          (f) => Math.abs(w[f] - p[f]) < 1e-9,
        ),
      ),
    ).toBe(true);
  });
});

// Guard for a DB-derived or hand-graded dataset.json. It stays SKIPPED unless
// that file exists AND is large enough to mean something; the 6-job demo set
// built on 25 July 2026 is below the bar on purpose.
const here = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(here, 'dataset.json');
const realDataset: BenchmarkDataset | null = existsSync(datasetPath)
  ? (JSON.parse(readFileSync(datasetPath, 'utf8')) as BenchmarkDataset)
  : null;
const MIN_JOBS = 30;

describe.skipIf(!realDataset || realDataset.jobs.length < MIN_JOBS)(
  'recommendation ranking benchmark (TC-18) on dataset.json',
  () => {
    it('the composite ranker beats the random baseline on nDCG@k', () => {
      const report = runBenchmark(realDataset!);
      const composite = report.results.find((r) => r.strategy === 'composite')!;
      const random = report.results.find((r) => r.strategy === 'random')!;
      expect(composite.ndcgAtK).toBeGreaterThanOrEqual(random.ndcgAtK);
    });
  },
);
