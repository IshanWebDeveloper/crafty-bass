import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import { OrdersService } from '../orders/orders.service.js';
import type {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewQueryDto,
  AdminReviewQueryDto,
} from './dto/index.js';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  private async refreshProductReviewAggregate(
    productId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    await client.$executeRaw`
      UPDATE "product" AS p
      SET
        "averageRating" = COALESCE(r."avgRating", 0),
        "reviewCount" = COALESCE(r."count", 0)
      FROM (
        SELECT
          AVG("rating")::DOUBLE PRECISION AS "avgRating",
          COUNT(*)::INTEGER AS "count"
        FROM "review"
        WHERE "productId" = ${productId}
      ) AS r
      WHERE p."id" = ${productId}
    `;
  }

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const hasPurchasedProduct =
      await this.ordersService.hasUserPurchasedProduct(userId, productId);
    if (!hasPurchasedProduct) {
      throw new ForbiddenException(
        'You can only review products you have purchased',
      );
    }

    // Enforce one review per user per product
    const existing = await this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing)
      throw new ConflictException('You have already reviewed this product');

    return this.prisma.$transaction(async (tx) => {
      const createdReview = await tx.review.create({
        data: { userId, productId, ...dto },
        include: { user: { select: { id: true, name: true } } },
      });

      await this.refreshProductReviewAggregate(productId, tx);

      return createdReview;
    });
  }

  async findByProduct(productId: string, query: ReviewQueryDto) {
    const { page, limit, sortBy, order } = query;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: { user: { select: { id: true, name: true, image: true } } },
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    return { data: reviews, meta: buildPaginationMeta(total, page, limit) };
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId)
      throw new ForbiddenException('Not your review');

    return this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id: reviewId },
        data: dto,
      });

      await this.refreshProductReviewAggregate(review.productId, tx);

      return updatedReview;
    });
  }

  async remove(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId)
      throw new ForbiddenException('Not your review');

    return this.prisma.$transaction(async (tx) => {
      const deletedReview = await tx.review.delete({ where: { id: reviewId } });

      await this.refreshProductReviewAggregate(review.productId, tx);

      return deletedReview;
    });
  }

  async findAllForAdmin(query: AdminReviewQueryDto) {
    const { page, limit, sortBy, order, productId, userId, rating } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(productId ? { productId } : {}),
      ...(userId ? { userId } : {}),
      ...(rating ? { rating } : {}),
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, slug: true } },
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
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!review) throw new NotFoundException('Review not found');

    return review;
  }

  async updateForAdmin(reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, productId: true },
    });

    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id: reviewId },
        data: dto,
      });

      await this.refreshProductReviewAggregate(review.productId, tx);

      return updatedReview;
    });
  }

  async removeForAdmin(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, productId: true },
    });

    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.$transaction(async (tx) => {
      const deletedReview = await tx.review.delete({ where: { id: reviewId } });

      await this.refreshProductReviewAggregate(review.productId, tx);

      return deletedReview;
    });
  }
}
