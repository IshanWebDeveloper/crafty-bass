import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';

type OwnershipJob = { homeownerId: string } | null;

interface JobDetail {
  id: string;
  homeownerId: string;
  categoryId: string | null;
  aiCategoryId: string | null;
  latitude: number | null;
  longitude: number | null;
  skills: Array<{ skillId: string }>;
}

interface Candidate {
  userId: string;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number;
  isVerified: boolean;
  jobsCompleted: number;
  jobsCancelled: number;
  responseTimeMinutes: number;
  skills: Array<{ skillId: string }>;
  user: { reviewsReceived: Array<{ rating: number; createdAt: Date }> };
}

function makePrisma(opts: {
  job?: OwnershipJob;
  jobDetail?: JobDetail | null;
  newestRec?: { createdAt: Date } | null;
  candidates?: Candidate[];
  recs?: unknown[];
}) {
  const {
    job = { homeownerId: 'owner' },
    jobDetail = null,
    newestRec = { createdAt: new Date() },
    candidates = [],
    recs = [],
  } = opts;

  // job.findUnique is called two ways: the ownership check (selects
  // homeownerId) and the generate step (selects skills). Branch on the select.
  const jobFindUnique = vi.fn((args: { select?: Record<string, unknown> }) =>
    Promise.resolve(args.select?.skills ? jobDetail : job),
  );
  const findFirst = vi.fn(() => Promise.resolve(newestRec));
  const findMany = vi.fn(() => Promise.resolve(recs));
  const deleteMany = vi.fn(() => Promise.resolve({ count: 0 }));
  const createMany = vi.fn((args: { data: unknown[] }) =>
    Promise.resolve({ count: args.data.length }),
  );
  const profileFindMany = vi.fn(() => Promise.resolve(candidates));
  const prisma = {
    job: { findUnique: jobFindUnique },
    jobRecommendation: { findFirst, findMany, deleteMany, createMany },
    tradesmanProfile: { findMany: profileFindMany },
    $transaction: vi.fn(() => Promise.resolve([])),
  } as unknown as PrismaService;

  return { prisma, jobFindUnique, findFirst, findMany, createMany, deleteMany };
}

function candidate(
  overrides: Partial<Candidate> & { userId: string },
): Candidate {
  return {
    latitude: 6.9,
    longitude: 79.9,
    serviceRadiusKm: 15,
    isVerified: false,
    jobsCompleted: 0,
    jobsCancelled: 0,
    responseTimeMinutes: 0,
    skills: [],
    user: { reviewsReceived: [] },
    ...overrides,
  };
}

describe('RecommendationsService.getJobRecommendations', () => {
  it('throws NotFound for a missing job', async () => {
    const { prisma } = makePrisma({ job: null });
    await expect(
      new RecommendationsService(prisma).getJobRecommendations('u1', 'job1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids a non-owner', async () => {
    const { prisma } = makePrisma({ job: { homeownerId: 'owner' } });
    await expect(
      new RecommendationsService(prisma).getJobRecommendations(
        'someone',
        'job1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns recommendations by rank without regenerating when fresh', async () => {
    const { prisma, findMany, jobFindUnique } = makePrisma({
      newestRec: { createdAt: new Date() },
      recs: [],
    });
    const result = await new RecommendationsService(
      prisma,
    ).getJobRecommendations('owner', 'job1');
    expect(result).toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: 'job1' },
        orderBy: { rank: 'asc' },
        take: 8,
      }),
    );
    // Fresh rows: the generate path (findUnique with a skills select) is skipped.
    expect(jobFindUnique.mock.calls.some((c) => c[0]?.select?.skills)).toBe(
      false,
    );
  });

  it('regenerates when no recommendations exist yet', async () => {
    const { prisma, jobFindUnique } = makePrisma({
      newestRec: null,
      jobDetail: {
        id: 'job1',
        homeownerId: 'owner',
        categoryId: null,
        aiCategoryId: null,
        latitude: null,
        longitude: null,
        skills: [],
      },
    });
    await new RecommendationsService(prisma).getJobRecommendations(
      'owner',
      'job1',
    );
    expect(jobFindUnique.mock.calls.some((c) => c[0]?.select?.skills)).toBe(
      true,
    );
  });
});

describe('RecommendationsService.generateForJob', () => {
  const jobDetail: JobDetail = {
    id: 'job1',
    homeownerId: 'owner',
    categoryId: 'cat-electrical',
    aiCategoryId: null,
    latitude: 6.9271,
    longitude: 79.8612,
    skills: [{ skillId: 'skill-wiring' }],
  };

  it('ranks a strong candidate above a weak one and persists them', async () => {
    const strong = candidate({
      userId: 't-strong',
      latitude: 6.928, // ~on the job
      longitude: 79.862,
      serviceRadiusKm: 25,
      isVerified: true,
      jobsCompleted: 50,
      jobsCancelled: 1,
      responseTimeMinutes: 20, // faster than target
      skills: [{ skillId: 'skill-wiring' }],
      user: {
        reviewsReceived: [
          { rating: 5, createdAt: new Date() },
          { rating: 5, createdAt: new Date() },
          { rating: 4, createdAt: new Date() },
        ],
      },
    });
    const weak = candidate({
      userId: 't-weak',
      latitude: 7.5, // far away
      longitude: 80.6,
      serviceRadiusKm: 5,
      isVerified: false,
      jobsCompleted: 1,
      jobsCancelled: 6,
      responseTimeMinutes: 1400, // near the poor ceiling
      skills: [],
      user: { reviewsReceived: [{ rating: 1, createdAt: new Date() }] },
    });

    const { prisma, createMany, deleteMany } = makePrisma({
      jobDetail,
      candidates: [weak, strong], // deliberately unsorted input
    });

    const count = await new RecommendationsService(prisma).generateForJob(
      'job1',
    );

    expect(count).toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: { jobId: 'job1' } });

    const data = createMany.mock.calls[0][0].data as Array<{
      tradesmanId: string;
      rank: number;
      score: number;
      reasons: { matchedSkillCount: number };
    }>;
    expect(data.map((d) => d.tradesmanId)).toEqual(['t-strong', 't-weak']);
    expect(data[0].rank).toBe(1);
    expect(data[1].rank).toBe(2);
    expect(data[0].score).toBeGreaterThan(data[1].score);
    // Every score stays within the scorer's [0, 1] range.
    for (const row of data) {
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(1);
    }
    // The strong candidate shares the job's skill; the weak one does not.
    expect(data[0].reasons.matchedSkillCount).toBe(1);
    expect(data[1].reasons.matchedSkillCount).toBe(0);
  });

  it('writes nothing (but still clears stale rows) when there are no candidates', async () => {
    const { prisma, createMany, deleteMany } = makePrisma({
      jobDetail,
      candidates: [],
    });
    const count = await new RecommendationsService(prisma).generateForJob(
      'job1',
    );
    expect(count).toBe(0);
    expect(deleteMany).toHaveBeenCalledWith({ where: { jobId: 'job1' } });
    expect(createMany).not.toHaveBeenCalled();
  });
});
