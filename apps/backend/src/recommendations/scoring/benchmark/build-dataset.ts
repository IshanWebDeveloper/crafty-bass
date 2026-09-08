/**
 * Builds the TC-18 benchmark dataset from the REAL database.
 *
 *   pnpm --filter backend exec tsx \
 *     src/recommendations/scoring/benchmark/build-dataset.ts
 *
 * Ground truth is derived from what actually happened on past jobs (implicit
 * relevance, the standard IR practice when explicit human grades are not
 * available) - it is never invented:
 *
 *   3  the tradesman was assigned AND the job completed   (hired and succeeded)
 *   2  the tradesman was assigned but the job did not complete
 *   1  the tradesman quoted but was not hired             (considered)
 *   0  an eligible candidate who did not quote            (not considered)
 *
 * Only jobs with a real outcome (an assignment or at least one quote) are
 * included, because a job nobody responded to carries no ranking signal. The
 * candidate pool mirrors RecommendationsService.generateForJob: available
 * tradesmen holding a skill in the job's category, falling back to all available
 * tradesmen when that yields nobody.
 *
 * Every candidate's features are read from the same columns the production
 * scorer reads, and review ages are measured relative to the JOB's date so the
 * benchmark reflects what was knowable at ranking time (no lookahead).
 */
import { PrismaClient, createDbAdapter } from '@repo/db';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const MS_PER_DAY = 86_400_000;
const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

async function main() {
  const prisma = new PrismaClient({ adapter: createDbAdapter() });

  // Jobs with an outcome to learn from.
  const jobs = await prisma.job.findMany({
    where: {
      OR: [{ assignedTradesmanId: { not: null } }, { quotes: { some: {} } }],
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      categoryId: true,
      latitude: true,
      longitude: true,
      assignedTradesmanId: true,
      quotes: { select: { tradesmanId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const out: Array<Record<string, unknown>> = [];

  for (const job of jobs) {
    const quoted = new Set(job.quotes.map((q) => q.tradesmanId));

    // Candidate pool, mirroring generateForJob's filter + fallback.
    const base = { isAvailable: true } as const;
    const byCategory = job.categoryId
      ? { ...base, skills: { some: { skill: { categoryId: job.categoryId } } } }
      : base;
    let profiles = await loadCandidates(prisma, byCategory);
    if (profiles.length === 0) profiles = await loadCandidates(prisma, base);
    if (profiles.length === 0) continue;

    const jobTime = job.createdAt.getTime();
    const candidates = profiles.map((p) => {
      const assigned = job.assignedTradesmanId === p.userId;
      const relevance = assigned
        ? job.status === 'COMPLETED'
          ? 3
          : 2
        : quoted.has(p.userId)
          ? 1
          : 0;
      return {
        tradesmanId: p.userId,
        relevance,
        // Only reviews that existed when the job was posted - no lookahead.
        reviews: p.user.reviewsReceived
          .filter((r) => r.createdAt.getTime() <= jobTime)
          .map((r) => ({
            rating: r.rating,
            ageDays: (jobTime - r.createdAt.getTime()) / MS_PER_DAY,
          })),
        location:
          p.latitude !== null && p.longitude !== null
            ? { lat: num(p.latitude)!, lng: num(p.longitude)! }
            : null,
        serviceRadiusKm: p.serviceRadiusKm,
        jobsCompleted: p.jobsCompleted,
        jobsCancelled: p.jobsCancelled,
        responseTimeMinutes:
          p.responseTimeMinutes > 0 ? p.responseTimeMinutes : null,
        isVerified: p.isVerified,
      };
    });

    // A job where nothing is relevant teaches the ranker nothing.
    if (!candidates.some((c) => c.relevance > 0)) continue;

    out.push({
      jobId: job.id,
      jobCoords:
        job.latitude !== null && job.longitude !== null
          ? { lat: num(job.latitude)!, lng: num(job.longitude)! }
          : null,
      candidates,
    });
  }

  const graded = out.reduce(
    (n, j) => n + (j.candidates as unknown[]).length,
    0,
  );
  const dataset = {
    provenance: {
      source: 'derived from the application database (implicit relevance)',
      relevanceScale:
        '3 = assigned and completed, 2 = assigned, 1 = quoted, 0 = eligible but did not quote',
      generatedAt: new Date().toISOString(),
      jobs: out.length,
      candidates: graded,
    },
    k: 5,
    relevanceThreshold: 1,
    jobs: out,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, 'dataset.json');
  writeFileSync(path, JSON.stringify(dataset, null, 2));
  console.log(
    `\nWrote ${path}\n  jobs with ground truth: ${out.length}\n  graded candidates: ${graded}\n`,
  );
  if (out.length === 0) {
    console.log(
      'No jobs carried an outcome, so there is nothing to benchmark yet. Complete\n' +
        'some jobs (or seed realistic history) and re-run.\n',
    );
  }
  await prisma.$disconnect();
}

function loadCandidates(prisma: PrismaClient, where: object) {
  return prisma.tradesmanProfile.findMany({
    where,
    select: {
      userId: true,
      latitude: true,
      longitude: true,
      serviceRadiusKm: true,
      jobsCompleted: true,
      jobsCancelled: true,
      responseTimeMinutes: true,
      isVerified: true,
      user: {
        select: {
          reviewsReceived: { select: { rating: true, createdAt: true } },
        },
      },
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
