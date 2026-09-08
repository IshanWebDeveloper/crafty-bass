/**
 * Recommendation ranking benchmark (TC-18).
 *
 * Ranks a labelled candidate set with the SAME scoring library and tie-break as
 * RecommendationsService.generateForJob, then scores the ranking against the
 * ground-truth relevance grades with precision@k, MRR and nDCG@k, and compares
 * the composite ranker to simple baselines. No numbers are invented: metrics are
 * computed from whatever ground truth `dataset.json` contains.
 */
import {
  compositeScore,
  reputationScore,
  proximityScore,
  completionScore,
  responseScore,
  type Coords,
  type WeightedReview,
} from '../index.js';
import { precisionAtK, reciprocalRank, ndcgAtK, mean } from '../metrics.js';

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

export interface BenchmarkReport {
  k: number;
  relevanceThreshold: number;
  jobCount: number;
  candidateCount: number;
  results: StrategyResult[];
  generatedAt: string;
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

/** Deterministic PRNG so the random baseline is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ranker = (job: BenchmarkJob) => BenchmarkCandidate[];

const rankers: Record<string, Ranker> = {
  // The production ranker: composite score, tie-broken by reputation then proximity.
  composite: (job) => {
    const scored = job.candidates.map((c) => {
      const s = subScores(job, c);
      const { score } = compositeScore({ ...s, verified: c.isVerified });
      return { c, score, rep: s.reputation, prox: s.proximity };
    });
    scored.sort(
      (a, b) => b.score - a.score || b.rep - a.rep || b.prox - a.prox,
    );
    return scored.map((x) => x.c);
  },
  reputationOnly: (job) =>
    [...job.candidates].sort(
      (a, b) =>
        reputationScore(b.reviews ?? []) - reputationScore(a.reviews ?? []),
    ),
  proximityOnly: (job) =>
    [...job.candidates].sort(
      (a, b) =>
        proximityScore(job.jobCoords, b.location, b.serviceRadiusKm) -
        proximityScore(job.jobCoords, a.location, a.serviceRadiusKm),
    ),
  random: (job) => {
    const rnd = mulberry32(0x5eed);
    return [...job.candidates].sort(() => rnd() - 0.5);
  },
};

export function runBenchmark(dataset: BenchmarkDataset): BenchmarkReport {
  const k = dataset.k ?? 5;
  const threshold = dataset.relevanceThreshold ?? 1;
  const results: StrategyResult[] = Object.entries(rankers).map(
    ([strategy, rank]) => {
      const p: number[] = [];
      const rr: number[] = [];
      const nd: number[] = [];
      for (const job of dataset.jobs) {
        const relevances = rank(job).map((c) => c.relevance ?? 0);
        p.push(precisionAtK(relevances, k, threshold));
        rr.push(reciprocalRank(relevances, threshold));
        nd.push(ndcgAtK(relevances, k));
      }
      return {
        strategy,
        precisionAtK: mean(p),
        mrr: mean(rr),
        ndcgAtK: mean(nd),
      };
    },
  );
  return {
    k,
    relevanceThreshold: threshold,
    jobCount: dataset.jobs.length,
    candidateCount: dataset.jobs.reduce((n, j) => n + j.candidates.length, 0),
    results,
    generatedAt: new Date().toISOString(),
  };
}
