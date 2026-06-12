import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import type {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewQueryDto,
  AdminReviewQueryDto,
} from './dto/index.js';

const REVIEW_PARTY_SELECT = { id: true, name: true, image: true } as const;
const ADMIN_PARTY_SELECT = { id: true, name: true, email: true } as const;

/**
 * Marketplace reviews: a job participant reviews their counterparty
 * (homeowner <-> assigned tradesman) against the job-based Review model.
 *
 * TODO(Phase C): enforce that the job is COMPLETED and that each side may only
 * review once the work is done; surface aggregate ratings on the profile.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reviewerId: string, jobId: string, dto: CreateReviewDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, homeownerId: true, assignedTradesmanId: true },
    });
    if (!job) throw new NotFoundException('Job not found');

    let revieweeId: string | null = null;
    if (reviewerId === job.homeownerId) {
      revieweeId = job.assignedTradesmanId;
    } else if (reviewerId === job.assignedTradesmanId) {
      revieweeId = job.homeownerId;
    }
    if (!revieweeId) {
      throw new ForbiddenException(
        'Only the job participants can leave a review',
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: {
        jobId_reviewerId_revieweeId: { jobId, reviewerId, revieweeId },
      },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this job');
    }

    return this.prisma.review.create({
      data: {
        jobId,
        reviewerId,
        revieweeId,
        rating: dto.rating,
        title: dto.title ?? null,
        comment: dto.comment ?? null,
      },
      include: { reviewer: { select: REVIEW_PARTY_SELECT } },
    });
  }

  async findForJob(jobId: string, query: ReviewQueryDto) {
    const { page, limit, sortBy, order } = query;
    const skip = (page - 1) * limit;
    const where = { jobId, isPublic: true };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: { reviewer: { select: REVIEW_PARTY_SELECT } },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data: reviews, meta: buildPaginationMeta(total, page, limit) };
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.reviewerId !== userId) {
      throw new ForbiddenException('Not your review');
    }

    return this.prisma.review.update({ where: { id: reviewId }, data: dto });
  }

  async remove(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.reviewerId !== userId) {
      throw new ForbiddenException('Not your review');
    }

    return this.prisma.review.delete({ where: { id: reviewId } });
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  async findAllForAdmin(query: AdminReviewQueryDto) {
    const { page, limit, sortBy, order, revieweeId, rating } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(revieweeId ? { revieweeId } : {}),
      ...(rating ? { rating } : {}),
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          reviewer: { select: ADMIN_PARTY_SELECT },
          reviewee: { select: ADMIN_PARTY_SELECT },
          job: { select: { id: true, title: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data: reviews, meta: buildPaginationMeta(total, page, limit) };
  }

  async findByIdForAdmin(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: { select: ADMIN_PARTY_SELECT },
        reviewee: { select: ADMIN_PARTY_SELECT },
        job: { select: { id: true, title: true } },
      },
    });

    if (!review) throw new NotFoundException('Review not found');

    return review;
  }

  async updateForAdmin(reviewId: string, dto: UpdateReviewDto) {
    await this.findByIdForAdmin(reviewId);
    return this.prisma.review.update({ where: { id: reviewId }, data: dto });
  }

  async removeForAdmin(reviewId: string) {
    await this.findByIdForAdmin(reviewId);
    return this.prisma.review.delete({ where: { id: reviewId } });
  }
}
