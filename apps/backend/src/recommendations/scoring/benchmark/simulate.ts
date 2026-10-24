/**
 * Latent-truth simulation for the recommendation benchmark (TC-18).
 *
 * Why a simulation: the platform has no real hiring history yet, and a dataset
 * derived from seeded demo rows (build-dataset.ts) is too small and too
 * artificial to say anything about ranking quality. This generator builds a
 * synthetic market where the TRUE quality of every tradesman is known, so the
 * benchmark can ask the question that matters:
 *
 *   Given only the NOISY, SPARSE signals the platform actually stores (a few
 *   star ratings, completion counts, a reply-time median, a location), does the
 *   ranker put the tradesmen who are genuinely best for the job at the top?
 *
 * Avoiding circularity. Ground truth is NOT computed from the scorer's formula:
 *  - relevance comes from LATENT attributes (true workmanship quality, true
 *    reliability, true responsiveness, travel feasibility) that the ranker never
 *    sees directly;
 *  - the ranker only sees observations sampled from those latents (ratings are
 *    noisy and rounded, newcomers have few or none, cancellations are a
 *    binomial draw, reply times are noisy);
 *  - the homeowner's preference weights are a parameter (`PreferenceProfile`)
 *    deliberately different from the production 35/30/20/15 split, and the
 *    benchmark is run across several profiles so no single assumption carries
 *    the result.
 *
 * Every assumption is a named constant below so it can be cited and challenged.
 */
import type {
  BenchmarkCandidate,
  BenchmarkDataset,
  BenchmarkJob,
} from './benchmark.js';
import { haversineKm, type Coords } from '../proximity.js';
import {
  mulberry32,
  normal,
  pick,
  randInt,
  shuffle,
  type Rng,
} from './random.js';

/** How much a simulated homeowner cares about each latent attribute. */
export interface PreferenceProfile {
  name: string;
  quality: number;
  reliability: number;
  distance: number;
  responsiveness: number;
}

export const PREFERENCE_PROFILES: PreferenceProfile[] = [
  {
    name: 'balanced',
    quality: 0.4,
    reliability: 0.25,
    distance: 0.2,
    responsiveness: 0.15,
  },
  {
    name: 'quality-first',
    quality: 0.55,
    reliability: 0.2,
    distance: 0.15,
    responsiveness: 0.1,
  },
  {
    name: 'convenience-first',
    quality: 0.25,
    reliability: 0.2,
    distance: 0.4,
    responsiveness: 0.15,
  },
  {
    name: 'reliability-first',
    quality: 0.25,
    reliability: 0.45,
    distance: 0.15,
    responsiveness: 0.15,
  },
  {
    name: 'equal',
    quality: 0.25,
    reliability: 0.25,
    distance: 0.25,
    responsiveness: 0.25,
  },
];

/** Western Province + Kandy/Kurunegala hubs the platform launches in. */
const HUBS: Coords[] = [
  { lat: 7.0917, lng: 79.9999 }, // Gampaha
  { lat: 6.9271, lng: 79.8612 }, // Colombo
  { lat: 7.2083, lng: 79.8358 }, // Negombo
  { lat: 7.2906, lng: 80.6337 }, // Kandy
  { lat: 7.4863, lng: 80.3647 }, // Kurunegala
];

export const SIMULATION_ASSUMPTIONS = {
  tradesmenPerHub: 80,
  /** Share of tradesmen who joined in the last month (cold-start cohort). */
  newcomerShare: 0.3,
  /** Latent workmanship quality ~ N(0.6, 0.18) clipped to [0.05, 1]. */
  quality: { mean: 0.6, sd: 0.18 },
  /** Latent reliability (prob. a job is completed) ~ N(0.85, 0.1) clipped [0.3, 0.99]. */
  reliability: { mean: 0.85, sd: 0.1 },
  /** Latent median reply time: log-normal around 2 hours. */
  replyMinutes: { logMean: Math.log(120), logSd: 1.0 },
  /** Past jobs per month of tenure (Poisson-like). */
  jobsPerMonth: 1.2,
  /** Probability a completed job leaves a review. */
  reviewRate: 0.6,
  /** Rating noise (stars, before rounding). */
  ratingNoiseSd: 0.8,
  /** Observed reply-time noise (log scale). */
  replyNoiseSd: 0.3,
  verifiedRate: { established: 0.6, newcomer: 0.3 },
  serviceRadiiKm: [10, 15, 20, 25, 30, 40],
  /** Candidates per job: most from the job's hub, some from elsewhere. */
  candidatesLocal: 14,
  candidatesRemote: 6,
  /** Homeowner idiosyncrasy added to the latent utility. */
  utilityNoiseSd: 0.03,
  /** Grades by within-job utility rank among FEASIBLE tradesmen. */
  gradeBands: { grade3: 1, grade2: 2, grade1: 3 },
  /** Spread of a tradesman's / job's position around its hub (degrees, ~1 deg = 111 km). */
  hubJitterDeg: 0.12,
} as const;

interface Tradesman {
  id: string;
  hub: number;
  location: Coords;
  serviceRadiusKm: number;
  newcomer: boolean;
  // latent (never shown to the ranker)
  quality: number;
  reliability: number;
  replyMinutes: number;
  // observed (what the platform stores)
  candidate: Omit<BenchmarkCandidate, 'relevance'>;
}

const clip = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

function poisson(rng: Rng, lambda: number): number {
  // Knuth; lambdas here are small (< 80).
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function jitter(rng: Rng, c: Coords): Coords {
  const j = SIMULATION_ASSUMPTIONS.hubJitterDeg;
  return {
    lat: c.lat + normal(rng, 0, j / 2),
    lng: c.lng + normal(rng, 0, j / 2),
  };
}

function makeTradesman(rng: Rng, id: string, hub: number): Tradesman {
  const A = SIMULATION_ASSUMPTIONS;
  const newcomer = rng() < A.newcomerShare;
  const tenureMonths = newcomer ? rng() : 2 + rng() * 58;
  const quality = clip(normal(rng, A.quality.mean, A.quality.sd), 0.05, 1);
  const reliability = clip(
    normal(rng, A.reliability.mean, A.reliability.sd),
    0.3,
    0.99,
  );
  const replyMinutes = Math.exp(
    normal(rng, A.replyMinutes.logMean, A.replyMinutes.logSd),
  );

  const pastJobs = newcomer
    ? randInt(rng, 0, 2)
    : poisson(rng, tenureMonths * A.jobsPerMonth);
  let completed = 0;
  for (let i = 0; i < pastJobs; i++) if (rng() < reliability) completed++;
  const cancelled = pastJobs - completed;

  const reviews = [];
  for (let i = 0; i < completed; i++) {
    if (rng() >= A.reviewRate) continue;
    const stars = Math.round(1 + 4 * quality + normal(rng, 0, A.ratingNoiseSd));
    reviews.push({
      rating: clip(stars, 1, 5),
      ageDays: rng() * tenureMonths * 30,
    });
  }

  const observedReply =
    pastJobs === 0
      ? null
      : Math.round(replyMinutes * Math.exp(normal(rng, 0, A.replyNoiseSd)));
  const location = jitter(rng, HUBS[hub]);
  const serviceRadiusKm = pick(rng, A.serviceRadiiKm);
  const isVerified =
    rng() < (newcomer ? A.verifiedRate.newcomer : A.verifiedRate.established);

  return {
    id,
    hub,
    location,
    serviceRadiusKm,
    newcomer,
    quality,
    reliability,
    replyMinutes,
    candidate: {
      tradesmanId: id,
      reviews,
      location,
      serviceRadiusKm,
      jobsCompleted: completed,
      jobsCancelled: cancelled,
      responseTimeMinutes: observedReply,
      isVerified,
    },
  };
}

/** Latent responsiveness in [0, 1] on a log scale (15 min -> 1, 24 h -> 0). */
function latentResponsiveness(minutes: number): number {
  return clip(
    1 - (Math.log(minutes) - Math.log(15)) / (Math.log(1440) - Math.log(15)),
    0,
    1,
  );
}

export interface SimulateOptions {
  seed: number;
  jobs: number;
  profile: PreferenceProfile;
  k?: number;
}

/**
 * Build a labelled benchmark dataset. Deterministic for a given seed. The
 * tradesman population depends only on the seed, so different preference
 * profiles are evaluated on the SAME market.
 */
export function simulateDataset({
  seed,
  jobs,
  profile,
  k = 5,
}: SimulateOptions): BenchmarkDataset {
  const A = SIMULATION_ASSUMPTIONS;
  const popRng = mulberry32(seed);
  const population: Tradesman[] = [];
  HUBS.forEach((_, hub) => {
    for (let i = 0; i < A.tradesmenPerHub; i++) {
      population.push(makeTradesman(popRng, `T${hub}-${i}`, hub));
    }
  });
  const byHub = HUBS.map((_, h) => population.filter((t) => t.hub === h));

  // Separate stream so job sampling and homeowner noise do not disturb the population.
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const out: BenchmarkJob[] = [];
  for (let j = 0; j < jobs; j++) {
    const hub = randInt(rng, 0, HUBS.length - 1);
    const jobCoords = jitter(rng, HUBS[hub]);
    const local = shuffle(rng, byHub[hub]).slice(0, A.candidatesLocal);
    const remote = shuffle(
      rng,
      population.filter((t) => t.hub !== hub),
    ).slice(0, A.candidatesRemote);
    const pool = [...local, ...remote];

    const scored = pool.map((t) => {
      const d = haversineKm(jobCoords, t.location);
      const feasible = d <= t.serviceRadiusKm;
      const utility = feasible
        ? profile.quality * t.quality +
          profile.reliability * t.reliability +
          profile.distance * (1 - d / t.serviceRadiusKm) +
          profile.responsiveness * latentResponsiveness(t.replyMinutes) +
          normal(rng, 0, A.utilityNoiseSd)
        : Number.NEGATIVE_INFINITY;
      return { t, feasible, utility };
    });
    const order = scored
      .filter((s) => s.feasible)
      .sort((a, b) => b.utility - a.utility)
      .map((s) => s.t.id);
    const { grade3, grade2, grade1 } = A.gradeBands;
    const gradeOf = (id: string) => {
      const r = order.indexOf(id);
      if (r < 0) return 0;
      if (r < grade3) return 3;
      if (r < grade3 + grade2) return 2;
      if (r < grade3 + grade2 + grade1) return 1;
      return 0;
    };

    // Present candidates in a shuffled order so input order carries no signal.
    const candidates = shuffle(rng, scored).map(({ t }) => ({
      ...t.candidate,
      relevance: gradeOf(t.id),
    }));
    if (!candidates.some((c) => c.relevance > 0)) continue; // nobody can serve this job
    out.push({ jobId: `SIM-${seed}-${j}`, jobCoords, candidates });
  }

  return { k, relevanceThreshold: 1, jobs: out };
}
