import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';

function makePrisma(job: { homeownerId: string } | null) {
  const findMany = vi.fn(() => Promise.resolve([]));
  const prisma = {
    job: { findUnique: vi.fn(() => Promise.resolve(job)) },
    jobRecommendation: { findMany },
  } as unknown as PrismaService;
  return { prisma, findMany };
}

describe('RecommendationsService.getJobRecommendations', () => {
  it('throws NotFound for a missing job', async () => {
    const { prisma } = makePrisma(null);
    await expect(
      new RecommendationsService(prisma).getJobRecommendations('u1', 'job1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids a non-owner', async () => {
    const { prisma } = makePrisma({ homeownerId: 'owner' });
    await expect(
      new RecommendationsService(prisma).getJobRecommendations(
        'someone',
        'job1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns recommendations by rank for the owner', async () => {
    const { prisma, findMany } = makePrisma({ homeownerId: 'owner' });
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
  });
});
