import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

/**
 * TODO(Phase C): rewrite recommendations for the tradesman marketplace.
 *
 * The previous implementation produced product recommendations from a user's
 * order history (models deleted in the marketplace migration). The marketplace
 * equivalent ranks tradesmen for a job via the `JobRecommendation` model
 * (jobId, tradesmanId, score, rank). This is a minimal compiling shell until
 * that feature is designed - see LEGACY_SWEEP_PLAN.md Phase C.
 */
@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the precomputed tradesman recommendations for a job, best rank
   * first. Only the job's owner may read them (mirrors QuotesService.listForJob).
   * Returns an empty list until the recommendation pipeline is built.
   */
  async getJobRecommendations(userId: string, jobId: string, take = 8) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { homeownerId: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.homeownerId !== userId) {
      throw new ForbiddenException(
        'Only the job owner can view recommendations',
      );
    }
    return this.prisma.jobRecommendation.findMany({
      where: { jobId },
      orderBy: { rank: 'asc' },
      take,
    });
  }
}
