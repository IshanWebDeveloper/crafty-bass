import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  reputationScore,
  proximityScore,
  completionScore,
  responseScore,
  compositeScore,
  type WeightedReview,
} from './scoring/index.js';

/** Recommendations older than this are recomputed on the next read. */
const STALE_MS = 60 * 60 * 1000;
/** How many ranked tradesmen we persist per job. */
const PERSIST_LIMIT = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Prisma's Decimal (or a null column) reduced to a JS number. */
function num(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}

/**
 * Ranks tradesmen for a job and persists the result as `JobRecommendation`
 * rows. The four sub-scores are produced by the pure, unit-tested scoring
 * library in `./scoring` (reputation .35 / proximity .30 / completion .20 /
 * response .15, plus a verified boost); this service only supplies it with real
 * data from the DB and stores the outcome.
 */
@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the ranked tradesman recommendations for a job, best rank first,
   * each joined with a light tradesman summary for display. Only the job's
   * owner may read them (mirrors QuotesService.listForJob). Recommendations are
   * (re)generated lazily when they are missing or stale.
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

    const newest = await this.prisma.jobRecommendation.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const isStale =
      !newest || Date.now() - newest.createdAt.getTime() > STALE_MS;
    if (isStale) {
      await this.generateForJob(jobId);
    }

    return this.prisma.jobRecommendation.findMany({
      where: { jobId },
      orderBy: { rank: 'asc' },
      take,
      select: {
        id: true,
        tradesmanId: true,
        score: true,
        rank: true,
        reasons: true,
        createdAt: true,
        tradesman: {
          select: {
            id: true,
            name: true,
            image: true,
            tradesmanProfile: {
              select: {
                city: true,
                district: true,
                avgRating: true,
                ratingCount: true,
                jobsCompleted: true,
                isVerified: true,
                serviceRadiusKm: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Forces a fresh recomputation for a job, then returns the ranked list.
   * Ownership is checked the same way as the read path.
   */
  async refreshJobRecommendations(userId: string, jobId: string, take = 8) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { homeownerId: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.homeownerId !== userId) {
      throw new ForbiddenException(
        'Only the job owner can refresh recommendations',
      );
    }
    await this.generateForJob(jobId);
    return this.getJobRecommendations(userId, jobId, take);
  }

  /**
   * Scores every eligible tradesman for a job and rewrites the job's
   * `JobRecommendation` rows in a single transaction. Idempotent: safe to call
   * repeatedly (it deletes and recreates the job's rows). Returns the number of
   * recommendations written.
   */
  async generateForJob(jobId: string): Promise<number> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        homeownerId: true,
        categoryId: true,
        aiCategoryId: true,
        latitude: true,
        longitude: true,
        skills: { select: { skillId: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');

    const targetCategoryId = job.categoryId ?? job.aiCategoryId;
    const jobSkillIds = new Set(job.skills.map((s) => s.skillId));
    const jobCoords =
      job.latitude !== null && job.longitude !== null
        ? { lat: num(job.latitude)!, lng: num(job.longitude)! }
        : null;

    // Candidate pool: available tradesmen (never the homeowner). When the job
    // has a category we prefer tradesmen who list a skill in it; if that yields
    // nobody we fall back to all available tradesmen so the homeowner still gets
    // suggestions.
    const baseWhere: Prisma.TradesmanProfileWhereInput = {
      isAvailable: true,
      user: { userType: 'TRADESMAN', id: { not: job.homeownerId } },
    };
    const categoryWhere: Prisma.TradesmanProfileWhereInput = targetCategoryId
      ? {
          ...baseWhere,
          skills: { some: { skill: { categoryId: targetCategoryId } } },
        }
      : baseWhere;

    let profiles = await this.loadCandidates(categoryWhere);
    if (profiles.length === 0 && targetCategoryId) {
      profiles = await this.loadCandidates(baseWhere);
    }

    const now = Date.now();
    const scored = profiles.map((p) => {
      const reviews: WeightedReview[] = p.user.reviewsReceived.map((r) => ({
        rating: r.rating,
        ageDays: (now - r.createdAt.getTime()) / MS_PER_DAY,
      }));
      const reputation = reputationScore(reviews);
      const proximity = proximityScore(
        jobCoords,
        p.latitude !== null && p.longitude !== null
          ? { lat: num(p.latitude)!, lng: num(p.longitude)! }
          : null,
        p.serviceRadiusKm,
      );
      const completion = completionScore({
        completed: p.jobsCompleted,
        cancelled: p.jobsCancelled,
      });
      // A default of 0 means "no reply time measured yet", not "instant" - map
      // it to null so the scorer applies its neutral missing-value score.
      const response = responseScore(
        p.responseTimeMinutes > 0 ? p.responseTimeMinutes : null,
      );
      const { score, breakdown, boost } = compositeScore({
        reputation,
        proximity,
        completion,
        response,
        verified: p.isVerified,
      });
      const matchedSkillCount = p.skills.reduce(
        (n, s) => (jobSkillIds.has(s.skillId) ? n + 1 : n),
        0,
      );
      return {
        tradesmanId: p.userId,
        score,
        subScores: { reputation, proximity, completion, response },
        breakdown,
        boost,
        verified: p.isVerified,
        matchedSkillCount,
      };
    });

    // Rank: best score first, breaking ties by reputation then proximity so the
    // order is deterministic.
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        b.subScores.reputation - a.subScores.reputation ||
        b.subScores.proximity - a.subScores.proximity,
    );
    const top = scored.slice(0, PERSIST_LIMIT);

    const generatedAt = new Date(now).toISOString();
    const rows: Prisma.JobRecommendationCreateManyInput[] = top.map(
      (s, index) => {
        const reasons: Prisma.InputJsonObject = {
          subScores: {
            reputation: s.subScores.reputation,
            proximity: s.subScores.proximity,
            completion: s.subScores.completion,
            response: s.subScores.response,
          },
          breakdown: {
            reputation: s.breakdown.reputation,
            proximity: s.breakdown.proximity,
            completion: s.breakdown.completion,
            response: s.breakdown.response,
          },
          verifiedBoost: s.boost,
          matchedSkillCount: s.matchedSkillCount,
        };
        const snapshot: Prisma.InputJsonObject = {
          verified: s.verified,
          generatedAt,
        };
        return {
          jobId,
          tradesmanId: s.tradesmanId,
          score: s.score,
          rank: index + 1,
          reasons,
          snapshot,
        };
      },
    );

    await this.prisma.$transaction([
      this.prisma.jobRecommendation.deleteMany({ where: { jobId } }),
      ...(rows.length > 0
        ? [this.prisma.jobRecommendation.createMany({ data: rows })]
        : []),
    ]);

    this.logger.log(
      `Generated ${rows.length} recommendation(s) for job ${jobId} from ${profiles.length} candidate(s)`,
    );
    return rows.length;
  }

  private loadCandidates(where: Prisma.TradesmanProfileWhereInput) {
    return this.prisma.tradesmanProfile.findMany({
      where,
      select: {
        userId: true,
        latitude: true,
        longitude: true,
        serviceRadiusKm: true,
        isVerified: true,
        jobsCompleted: true,
        jobsCancelled: true,
        responseTimeMinutes: true,
        skills: { select: { skillId: true } },
        user: {
          select: {
            reviewsReceived: {
              where: { isPublic: true },
              select: { rating: true, createdAt: true },
            },
          },
        },
      },
    });
  }
}
