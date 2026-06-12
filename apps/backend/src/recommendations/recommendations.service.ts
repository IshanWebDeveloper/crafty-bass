import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

/**
 * TODO(Phase C): rewrite recommendations for the tradesman marketplace.
 *
 * The previous implementation produced product recommendations from a user's
 * order history (models deleted in the marketplace migration). The marketplace
 * equivalent ranks tradesmen for a job via the `JobRecommendation` model
 * (jobId, tradesmanId, score, rank). This is a minimal compiling shell until
 * that feature is designed.
 */
@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the precomputed tradesman recommendations for a job, best rank first.
   * Returns an empty list until the recommendation pipeline is built.
   */
  async getJobRecommendations(jobId: string, take = 8) {
    return this.prisma.jobRecommendation.findMany({
      where: { jobId },
      orderBy: { rank: 'asc' },
      take,
    });
  }
}
