/**
 * Weight sensitivity sweep for the composite ranker.
 *
 * Enumerates every weight vector on a 0.05 grid (each weight >= 0.05, summing to
 * 1) and measures mean nDCG@k. To avoid reporting an over-fitted "best" weight
 * set, weights are SELECTED on a tuning dataset and EVALUATED on a separate
 * held-out dataset generated from a different seed.
 */
import { SCORING_CONFIG, type ScoreWeights } from '../index.js';
import { ndcgAtK, mean } from '../metrics.js';
import { rankComposite, type BenchmarkDataset } from './benchmark.js';

export function weightGrid(step = 0.05, min = 0.05): ScoreWeights[] {
  const n = Math.round(1 / step);
  const lo = Math.round(min / step);
  const out: ScoreWeights[] = [];
  for (let a = lo; a <= n; a++)
    for (let b = lo; a + b <= n; b++)
      for (let c = lo; a + b + c <= n; c++) {
        const d = n - a - b - c;
        if (d < lo) continue;
        const r = (x: number) => Math.round(x * step * 1000) / 1000;
        out.push({
          reputation: r(a),
          proximity: r(b),
          completion: r(c),
          response: r(d),
        });
      }
  return out;
}

export function meanNdcg(
  dataset: BenchmarkDataset,
  weights: ScoreWeights,
): number {
  const k = dataset.k ?? 5;
  return mean(
    dataset.jobs.map((job) =>
      ndcgAtK(
        rankComposite(job, weights).map((c) => c.relevance),
        k,
      ),
    ),
  );
}

export interface SweepReport {
  gridSize: number;
  production: {
    weights: ScoreWeights;
    tuneNdcg: number;
    testNdcg: number;
    percentile: number;
  };
  bestOnTune: { weights: ScoreWeights; tuneNdcg: number; testNdcg: number };
  /** Spread of nDCG over the whole grid on the tuning set. */
  tuneRange: { min: number; median: number; max: number };
  /** Top 5 weight vectors by tuning nDCG. */
  top: Array<{ weights: ScoreWeights; tuneNdcg: number }>;
}

export function runSweep(
  tune: BenchmarkDataset,
  test: BenchmarkDataset,
): SweepReport {
  const grid = weightGrid();
  const scored = grid.map((w) => ({ weights: w, tuneNdcg: meanNdcg(tune, w) }));
  scored.sort((a, b) => b.tuneNdcg - a.tuneNdcg);
  const prod = { ...SCORING_CONFIG.weights };
  const prodTune = meanNdcg(tune, prod);
  const below = scored.filter((s) => s.tuneNdcg < prodTune).length;
  const vals = scored.map((s) => s.tuneNdcg).sort((a, b) => a - b);
  const best = scored[0];
  return {
    gridSize: grid.length,
    production: {
      weights: prod,
      tuneNdcg: prodTune,
      testNdcg: meanNdcg(test, prod),
      percentile: below / grid.length,
    },
    bestOnTune: {
      weights: best.weights,
      tuneNdcg: best.tuneNdcg,
      testNdcg: meanNdcg(test, best.weights),
    },
    tuneRange: {
      min: vals[0],
      median: vals[Math.floor(vals.length / 2)],
      max: vals[vals.length - 1],
    },
    top: scored.slice(0, 5),
  };
}

export interface RobustnessReport {
  profiles: string[];
  gridSize: number;
  /** For each weight vector: mean nDCG across profiles, and worst-case regret
   *  (largest gap to the best vector for that profile). Lower regret = a safer
   *  choice when the true homeowner preference is unknown. */
  production: {
    meanNdcg: number;
    maxRegret: number;
    meanRank: number;
    regretRank: number;
  };
  bestByMean: { weights: ScoreWeights; meanNdcg: number; maxRegret: number };
  minimaxRegret: { weights: ScoreWeights; meanNdcg: number; maxRegret: number };
}

const sameWeights = (a: ScoreWeights, b: ScoreWeights) =>
  (['reputation', 'proximity', 'completion', 'response'] as const).every(
    (f) => Math.abs(a[f] - b[f]) < 1e-9,
  );

/** Robustness of every grid vector across several preference-profile datasets. */
export function runRobustness(
  datasets: Array<{ profile: string; dataset: BenchmarkDataset }>,
): RobustnessReport {
  const grid = weightGrid();
  const prod = { ...SCORING_CONFIG.weights };
  if (!grid.some((w) => sameWeights(w, prod))) grid.push(prod);
  const table = grid.map((w) => datasets.map((d) => meanNdcg(d.dataset, w)));
  const bestPer = datasets.map((_, j) =>
    Math.max(...table.map((row) => row[j])),
  );
  const rows = grid.map((w, i) => ({
    weights: w,
    meanNdcg: mean(table[i]),
    maxRegret: Math.max(...table[i].map((v, j) => bestPer[j] - v)),
  }));
  const pi = grid.findIndex((w) => sameWeights(w, prod));
  const p = rows[pi];
  const byMean = [...rows].sort((a, b) => b.meanNdcg - a.meanNdcg);
  const byRegret = [...rows].sort((a, b) => a.maxRegret - b.maxRegret);
  return {
    profiles: datasets.map((d) => d.profile),
    gridSize: grid.length,
    production: {
      meanNdcg: p.meanNdcg,
      maxRegret: p.maxRegret,
      meanRank: byMean.indexOf(p) + 1,
      regretRank: byRegret.indexOf(p) + 1,
    },
    bestByMean: byMean[0],
    minimaxRegret: byRegret[0],
  };
}
