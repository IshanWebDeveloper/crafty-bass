/**
 * Recommendation ranking benchmark (TC-18).
 *
 * Ranks a labelled candidate set with the SAME scoring library and tie-break as
 * RecommendationsService.generateForJob, then scores the ranking against the
 * ground-truth relevance grades with precision@k, MRR and nDCG@k, and compares
 * the composite ranker to simple baselines. It also reports:
 *  - a paired bootstrap 95% CI for the nDCG@k difference composite − baseline,
 *    so "composite wins" is a statistical claim, not a point estimate;
 *  - cold-start exposure: how often tradesmen with almost no reviews reach the
 *    top-k, compared with how often they are genuinely among the best for a job.
 * No numbers are invented: metrics are computed from whatever ground truth the
 * dataset contains (DB-derived via build-dataset.ts, or simulate.ts).
 */
import {
  SCORING_CONFIG,
  compositeScore,
  reputationScore,
  proximityScore,
  completionScore,
  responseScore,
  type Coords,
  type ScoreWeights,
  type WeightedReview,
} from '../index.js';
import { precisionAtK, reciprocalRank, ndcgAtK, mean } from '../metrics.js';
import { mulberry32, shuffle } from './random.js';

export interface BenchmarkCandidate {
  tradesmanId: string;
  /** Ground-truth relevance grade: 0 = irrelevant, higher = more relevant. */
  relevance: number;
  reviews: WeightedReview[];
  location: Coords | null;
  serviceRadiusKm: number;
  jobsCompleted: number;
  jobsCancelled: number;
  /** Median reply time in minutes; 0 or null means "no data measured". */
  responseTimeMinutes: number | null;
  isVerified: boolean;
}

export interface BenchmarkJob {
  jobId: string;
  jobCoords: Coords | null;
  candidates: BenchmarkCandidate[];
}

export interface BenchmarkDataset {
  jobs: BenchmarkJob[];
  /** Cut-off for precision@k / nDCG@k (default 5). */
  k?: number;
  /** Relevance grade counted as "relevant" for precision/MRR (default 1). */
  relevanceThreshold?: number;
}

export interface StrategyResult {
  strategy: string;
  precisionAtK: number;
  mrr: number;
  ndcgAtK: number;
}

export interface PairedComparison {
  baseline: string;
  /** Mean nDCG@k(composite) − nDCG@k(baseline) across jobs. */
  ndcgDelta: number;
  ci95: [number, number];
  /** Share of jobs where composite strictly beats / ties the baseline. */
  winRate: number;
  tieRate: number;
}

export interface ColdStartReport {
  /** A candidate with at most this many reviews counts as cold-start. */
  maxReviews: number;
  /** Share of all candidates who are cold-start. */
  poolShare: number;
  /** Share of grade>=2 (genuinely strong) candidates who are cold-start. */
  strongShare: number;
  /** Per strategy: share of top-k slots held by cold-start tradesmen, and the
   *  share of strong cold-start candidates that reach the top-k (recall). */
  byStrategy: Array<{
    strategy: string;
    topKShare: number;
    strongRecall: number;
  }>;
}

export interface BenchmarkReport {
  k: number;
  relevanceThreshold: number;
  jobCount: number;
  candidateCount: number;
  results: StrategyResult[];
  comparisons: PairedComparison[];
  coldStart: ColdStartReport;
  generatedAt: string;
}

export interface BenchmarkOptions {
  /** Weights for the composite ranker (defaults to production config). */
  weights?: ScoreWeights;
  /** Shuffles averaged for the random baseline's expected value. */
  randomRepeats?: number;
  bootstrapSamples?: number;
  seed?: number;
  coldStartMaxReviews?: number;
}

/** The four sub-scores exactly as generateForJob derives them. */
function subScores(job: BenchmarkJob, c: BenchmarkCandidate) {
  return {
    reputation: reputationScore(c.reviews ?? []),
    proximity: proximityScore(job.jobCoords, c.location, c.serviceRadiusKm),
    completion: completionScore({
      completed: c.jobsCompleted,
      cancelled: c.jobsCancelled,
    }),
    // 0 means "not measured", not "instant" - map to null for the neutral score.
    response: responseScore(
      c.responseTimeMinutes && c.responseTimeMinutes > 0
        ? c.responseTimeMinutes
        : null,
    ),
  };
}

/** Production ranker: composite score, tie-broken by reputation then proximity. */
export function rankComposite(
  job: BenchmarkJob,
  weights: ScoreWeights = SCORING_CONFIG.weights,
): BenchmarkCandidate[] {
  const scored = job.candidates.map((c) => {
    const s = subScores(job, c);
    const { score } = compositeScore({ ...s, verified: c.isVerified }, weights);
    return { c, score, rep: s.reputation, prox: s.proximity };
  });
  scored.sort((a, b) => b.score - a.score || b.rep - a.rep || b.prox - a.prox);
  return scored.map((x) => x.c);
}

/** Raw mean star rating, no prior, no recency; unrated tradesmen sink to the
 *  bottom. This is what a naive marketplace listing does, and the baseline the
 *  Bayesian prior is designed to beat on cold-start. */
function naiveRating(c: BenchmarkCandidate): number {
  const r = c.reviews ?? [];
  return r.length === 0 ? 0 : r.reduce((s, x) => s + x.rating, 0) / r.length;
}

type Ranker = (job: BenchmarkJob) => BenchmarkCandidate[];

function deterministicRankers(weights: ScoreWeights): Record<string, Ranker> {
  return {
    composite: (job) => rankComposite(job, weights),
    reputationOnly: (job) =>
      [...job.candidates].sort(
        (a, b) =>
          reputationScore(b.reviews ?? []) - reputationScore(a.reviews ?? []),
      ),
    naiveAverageRating: (job) =>
      [...job.candidates].sort(
        (a, b) =>
          naiveRating(b) - naiveRating(a) ||
          (b.reviews?.length ?? 0) - (a.reviews?.length ?? 0),
      ),
    proximityOnly: (job) =>
      [...job.candidates].sort(
        (a, b) =>
          proximityScore(job.jobCoords, b.location, b.serviceRadiusKm) -
          proximityScore(job.jobCoords, a.location, a.serviceRadiusKm),
      ),
  };
}

interface PerJob {
  p: number[];
  rr: number[];
  nd: number[];
  /** cold-start slots in top-k, and strong cold-start candidates that made it */
  csTop: number;
  csStrongHit: number;
}

function scoreRanking(
  ranked: BenchmarkCandidate[],
  k: number,
  threshold: number,
  isCold: (c: BenchmarkCandidate) => boolean,
) {
  const rel = ranked.map((c) => c.relevance ?? 0);
  const top = ranked.slice(0, k);
  return {
    p: precisionAtK(rel, k, threshold),
    rr: reciprocalRank(rel, threshold),
    nd: ndcgAtK(rel, k),
    csTop: top.filter(isCold).length,
    csStrongHit: top.filter((c) => isCold(c) && (c.relevance ?? 0) >= 2).length,
  };
}

/** Paired bootstrap over jobs: resample job indices, recompute the mean delta. */
function bootstrapCi(
  deltas: number[],
  samples: number,
  seed: number,
): [number, number] {
  if (deltas.length === 0) return [0, 0];
  const rng = mulberry32(seed);
  const means: number[] = [];
  for (let b = 0; b < samples; b++) {
    let s = 0;
    for (let i = 0; i < deltas.length; i++)
      s += deltas[Math.floor(rng() * deltas.length)];
    means.push(s / deltas.length);
  }
  means.sort((a, b) => a - b);
  const at = (q: number) =>
    means[Math.min(means.length - 1, Math.floor(q * means.length))];
  return [at(0.025), at(0.975)];
}

export function runBenchmark(
  dataset: BenchmarkDataset,
  opts: BenchmarkOptions = {},
): BenchmarkReport {
  const k = dataset.k ?? 5;
  const threshold = dataset.relevanceThreshold ?? 1;
  const weights = opts.weights ?? SCORING_CONFIG.weights;
  const repeats = opts.randomRepeats ?? 200;
  const B = opts.bootstrapSamples ?? 2000;
  const seed = opts.seed ?? 0x5eed;
  const maxReviews = opts.coldStartMaxReviews ?? 2;
  const isCold = (c: BenchmarkCandidate) =>
    (c.reviews?.length ?? 0) <= maxReviews;

  const perStrategy: Record<string, PerJob> = {};
  const init = (): PerJob => ({
    p: [],
    rr: [],
    nd: [],
    csTop: 0,
    csStrongHit: 0,
  });

  for (const [name, rank] of Object.entries(deterministicRankers(weights))) {
    const acc = init();
    for (const job of dataset.jobs) {
      const s = scoreRanking(rank(job), k, threshold, isCold);
      acc.p.push(s.p);
      acc.rr.push(s.rr);
      acc.nd.push(s.nd);
      acc.csTop += s.csTop;
      acc.csStrongHit += s.csStrongHit;
    }
    perStrategy[name] = acc;
  }

  // Random baseline: the EXPECTED metric under a uniform shuffle, estimated per
  // job by averaging many independent Fisher-Yates shuffles.
  const rnd = mulberry32(seed);
  const random = init();
  for (const job of dataset.jobs) {
    let p = 0,
      rr = 0,
      nd = 0,
      csTop = 0,
      csHit = 0;
    for (let r = 0; r < repeats; r++) {
      const s = scoreRanking(
        shuffle(rnd, job.candidates),
        k,
        threshold,
        isCold,
      );
      p += s.p;
      rr += s.rr;
      nd += s.nd;
      csTop += s.csTop;
      csHit += s.csStrongHit;
    }
    random.p.push(p / repeats);
    random.rr.push(rr / repeats);
    random.nd.push(nd / repeats);
    random.csTop += csTop / repeats;
    random.csStrongHit += csHit / repeats;
  }
  perStrategy.random = random;

  const results: StrategyResult[] = Object.entries(perStrategy).map(
    ([strategy, a]) => ({
      strategy,
      precisionAtK: mean(a.p),
      mrr: mean(a.rr),
      ndcgAtK: mean(a.nd),
    }),
  );

  const comp = perStrategy.composite.nd;
  const comparisons: PairedComparison[] = Object.entries(perStrategy)
    .filter(([name]) => name !== 'composite')
    .map(([baseline, a], i) => {
      const deltas = comp.map((x, j) => x - a.nd[j]);
      const eps = 1e-12;
      return {
        baseline,
        ndcgDelta: mean(deltas),
        ci95: bootstrapCi(deltas, B, seed + 1 + i),
        winRate:
          deltas.filter((d) => d > eps).length / Math.max(1, deltas.length),
        tieRate:
          deltas.filter((d) => Math.abs(d) <= eps).length /
          Math.max(1, deltas.length),
      };
    });

  const all = dataset.jobs.flatMap((j) => j.candidates);
  const strong = all.filter((c) => (c.relevance ?? 0) >= 2);
  const strongCold = strong.filter(isCold).length;
  const slots = dataset.jobs.reduce(
    (n, j) => n + Math.min(k, j.candidates.length),
    0,
  );
  const coldStart: ColdStartReport = {
    maxReviews,
    poolShare: all.filter(isCold).length / Math.max(1, all.length),
    strongShare: strongCold / Math.max(1, strong.length),
    byStrategy: Object.entries(perStrategy).map(([strategy, a]) => ({
      strategy,
      topKShare: a.csTop / Math.max(1, slots),
      strongRecall: a.csStrongHit / Math.max(1, strongCold),
    })),
  };

  return {
    k,
    relevanceThreshold: threshold,
    jobCount: dataset.jobs.length,
    candidateCount: all.length,
    results,
    comparisons,
    coldStart,
    generatedAt: new Date().toISOString(),
  };
}
