import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { S3Service } from '../admin/s3.service.js';
import { Prisma } from '@prisma/client';

type RecommendationProduct = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true } };
    images: true;
    variants: { select: { id: true; price: true; stock: true } };
    _count: { select: { reviews: true } };
  };
}>;

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Returns personalized product recommendations for a user.
   *
   * Strategy:
   * 1. Look at the user's past order items → extract purchased category IDs
   * 2. Find top-rated / best-selling products in those categories (excluding already purchased)
   * 3. Fall back to globally best-selling products for new users (cold-start)
   */
  async getRecommendations(userId: string, take = 8) {
    // Get the user's previously ordered product IDs and their categories
    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: { userId } },
      select: {
        variant: {
          select: {
            productId: true,
            product: { select: { categoryId: true } },
          },
        },
      },
    });

    const purchasedProductIds = [
      ...new Set(orderItems.map((item) => item.variant.productId)),
    ];
    const purchasedCategoryIds = [
      ...new Set(orderItems.map((item) => item.variant.product.categoryId)),
    ];

    // If user has purchase history, recommend from their preferred categories
    if (purchasedCategoryIds.length > 0) {
      const data = await this.prisma.product.findMany({
        where: {
          isActive: true,
          categoryId: { in: purchasedCategoryIds },
          id: { notIn: purchasedProductIds },
        },
        take,
        orderBy: [{ reviews: { _count: 'desc' } }, { createdAt: 'desc' }],
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { take: 1, orderBy: { position: 'asc' } },
          variants: {
            select: { id: true, price: true, stock: true },
            take: 1,
            orderBy: { price: 'asc' },
          },
          _count: { select: { reviews: true } },
        },
      });
      const recommendations = await Promise.all(
        data.map((product) => this.attachSignedImageUrls(product)),
      );

      // If we got enough results, return them
      if (recommendations.length >= take) {
        return recommendations;
      }

      // Otherwise, pad with globally popular products
      const existingIds = [
        ...purchasedProductIds,
        ...recommendations.map((r) => r.id),
      ];
      const remaining = take - recommendations.length;

      const globalFillData = await this.getGloballyPopular(
        existingIds,
        remaining,
      );
      const globalFill = await Promise.all(
        globalFillData.map((product) => this.attachSignedImageUrls(product)),
      );
      return [...recommendations, ...globalFill];
    }

    // Cold-start: no purchase history → return globally popular products
    const recommendationsData = await this.getGloballyPopular(
      purchasedProductIds,
      take,
    );

    return Promise.all(
      recommendationsData.map((product) => this.attachSignedImageUrls(product)),
    );
  }

  /**
   * Returns globally popular products (best-reviewed, newest).
   * Excludes products in the `excludeIds` list.
   */
  private async getGloballyPopular(
    excludeIds: string[],
    take: number,
  ): Promise<RecommendationProduct[]> {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(excludeIds.length > 0 && { id: { notIn: excludeIds } }),
      },
      take,
      orderBy: [{ reviews: { _count: 'desc' } }, { createdAt: 'desc' }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { take: 1, orderBy: { position: 'asc' } },
        variants: {
          select: { id: true, price: true, stock: true },
          take: 1,
          orderBy: { price: 'asc' },
        },
        _count: { select: { reviews: true } },
      },
    });
  }
  private async attachSignedImageUrls(
    product: RecommendationProduct,
  ): Promise<RecommendationProduct> {
    const images = await Promise.all(
      product.images.map(async (image) => ({
        ...image,
        url: await this.s3Service.getPresignedDownloadUrl(image.url),
      })),
    );
    return {
      ...product,
      images,
    };
  }
}
