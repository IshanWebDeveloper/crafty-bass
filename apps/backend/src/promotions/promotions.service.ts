import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Promotion, PromotionType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service.js';

interface PromotionResolutionResult {
  promotionId: string;
  promotionCode: string;
  promotionType: PromotionType;
  promotionValue: number;
  discountAmount: number;
}

interface ResolveCheckoutPromotionInput {
  subtotalAmount: number;
  cartProductIds: string[];
  code?: string;
  tx?: Prisma.TransactionClient;
}

type PromotionCandidate = {
  promotion: Promotion;
  discountAmount: number;
};

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  private toMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  normalizePromotionCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private calculateDiscount(subtotalAmount: number, promotion: Promotion) {
    const promotionValue = Number(promotion.value);
    let discountAmount = 0;

    switch (promotion.type) {
      case 'PERCENTAGE':
      case 'FLASH_SALE':
        discountAmount = (subtotalAmount * promotionValue) / 100;
        break;
      case 'FIXED_AMOUNT':
        discountAmount = promotionValue;
        break;
      case 'FREE_SHIPPING':
        discountAmount = 0;
        break;
      default:
        discountAmount = 0;
    }

    return this.toMoney(Math.max(0, Math.min(discountAmount, subtotalAmount)));
  }

  private getTypePriority(type: PromotionType): number {
    switch (type) {
      case 'FLASH_SALE':
        return 400;
      case 'PERCENTAGE':
        return 300;
      case 'FIXED_AMOUNT':
        return 200;
      case 'FREE_SHIPPING':
        return 100;
      default:
        return 0;
    }
  }

  private compareCandidates(a: PromotionCandidate, b: PromotionCandidate) {
    const typePriorityDelta =
      this.getTypePriority(b.promotion.type) -
      this.getTypePriority(a.promotion.type);

    if (typePriorityDelta !== 0) {
      return typePriorityDelta;
    }

    if (b.discountAmount !== a.discountAmount) {
      return b.discountAmount - a.discountAmount;
    }

    const startDelta =
      a.promotion.startsAt.getTime() - b.promotion.startsAt.getTime();
    if (startDelta !== 0) {
      return startDelta;
    }

    const endDelta =
      a.promotion.endsAt.getTime() - b.promotion.endsAt.getTime();
    if (endDelta !== 0) {
      return endDelta;
    }

    return a.promotion.id.localeCompare(b.promotion.id);
  }

  private assertPromotionActiveNow(promotion: Promotion, now: Date) {
    if (!promotion.isActive) {
      throw new BadRequestException('Promotion is inactive');
    }

    if (promotion.startsAt > now) {
      throw new BadRequestException('Promotion is not active yet');
    }

    if (promotion.endsAt < now) {
      throw new BadRequestException('Promotion has expired');
    }
  }

  private formatPromotionLabel(promotion: Promotion) {
    return promotion.code
      ? `${promotion.title} (${promotion.code})`
      : promotion.title;
  }

  async resolveCheckoutPromotion({
    subtotalAmount,
    cartProductIds,
    code,
    tx,
  }: ResolveCheckoutPromotionInput): Promise<PromotionResolutionResult | null> {
    if (subtotalAmount <= 0) {
      throw new BadRequestException('Subtotal must be greater than zero');
    }

    const uniqueCartProductIds = [...new Set(cartProductIds)];
    const normalizedCode = code ? this.normalizePromotionCode(code) : undefined;
    const now = new Date();

    const findManyArgs: Prisma.PromotionFindManyArgs = {
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    };

    const activePromotions: Promotion[] = tx
      ? await tx.promotion.findMany(findManyArgs)
      : await this.prisma.promotion.findMany(findManyArgs);

    const activePromotionIds = activePromotions.map(
      (promotion) => promotion.id,
    );

    const flashSaleMatches =
      activePromotionIds.length > 0 && uniqueCartProductIds.length > 0
        ? tx
          ? await tx.$queryRaw<
              Array<{ promotionId: string; productId: string }>
            >`
              SELECT "promotionId", "productId"
              FROM "flash_sale_product"
              WHERE "promotionId" IN (${Prisma.join(activePromotionIds)})
                AND "productId" IN (${Prisma.join(uniqueCartProductIds)})
            `
          : await this.prisma.$queryRaw<
              Array<{ promotionId: string; productId: string }>
            >`
              SELECT "promotionId", "productId"
              FROM "flash_sale_product"
              WHERE "promotionId" IN (${Prisma.join(activePromotionIds)})
                AND "productId" IN (${Prisma.join(uniqueCartProductIds)})
            `
        : [];

    const flashSalePromotionIdSet = new Set(
      flashSaleMatches.map((item) => item.promotionId),
    );

    let explicitPromotion: Promotion | undefined;
    if (normalizedCode) {
      explicitPromotion = activePromotions.find(
        (promotion) =>
          promotion.code !== null &&
          this.normalizePromotionCode(promotion.code) === normalizedCode,
      );

      if (!explicitPromotion) {
        const findFirstArgs: Prisma.PromotionFindFirstArgs = {
          where: {
            code: {
              equals: normalizedCode,
              mode: 'insensitive',
            },
          },
        };

        const anyPromotion = tx
          ? await tx.promotion.findFirst(findFirstArgs)
          : await this.prisma.promotion.findFirst(findFirstArgs);

        if (!anyPromotion) {
          throw new BadRequestException('Invalid promotion code');
        }

        this.assertPromotionActiveNow(anyPromotion, now);
      }
    }

    const candidates = activePromotions
      .filter((promotion) => {
        if (
          promotion.minAmount !== null &&
          subtotalAmount < Number(promotion.minAmount)
        ) {
          return false;
        }

        const isFlashSaleApplicable =
          promotion.type !== 'FLASH_SALE' ||
          flashSalePromotionIdSet.has(promotion.id);

        if (!isFlashSaleApplicable) {
          return false;
        }

        const isExplicitCodeMatch =
          explicitPromotion !== undefined &&
          promotion.id === explicitPromotion.id;
        const isAutoFlashSale =
          promotion.type === 'FLASH_SALE' && promotion.code === null;

        if (normalizedCode) {
          return isExplicitCodeMatch || isAutoFlashSale;
        }

        return isAutoFlashSale;
      })
      .map((promotion) => ({
        promotion,
        discountAmount: this.calculateDiscount(subtotalAmount, promotion),
      }))
      .sort((a, b) => this.compareCandidates(a, b));

    if (candidates.length === 0) {
      return null;
    }

    if (normalizedCode && candidates.length > 1) {
      const labels = candidates
        .map((candidate) => this.formatPromotionLabel(candidate.promotion))
        .join(', ');

      throw new BadRequestException(
        `Conflicting active promotions detected: ${labels}. Promotions cannot be stacked at checkout.`,
      );
    }

    if (candidates.length > 1) {
      const [top, next] = candidates;
      const hasPriorityConflict =
        this.getTypePriority(top.promotion.type) ===
        this.getTypePriority(next.promotion.type);

      if (hasPriorityConflict) {
        const labels = [top, next]
          .map((candidate) => this.formatPromotionLabel(candidate.promotion))
          .join(', ');

        throw new BadRequestException(
          `Conflicting active promotions detected: ${labels}. Please contact support or retry later.`,
        );
      }
    }

    const selected = candidates[0];

    return {
      promotionId: selected.promotion.id,
      promotionCode:
        selected.promotion.code ??
        `${selected.promotion.type}_${selected.promotion.id}`,
      promotionType: selected.promotion.type,
      promotionValue: Number(selected.promotion.value),
      discountAmount: selected.discountAmount,
    };
  }

  async getActivePromotions() {
    const now = new Date();

    return this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { endsAt: 'asc' },
    });
  }

  async checkUserEligibility(userId: string, promotionCode: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { code: promotionCode },
    });

    if (!promotion || !promotion.isActive) {
      return false;
    }

    const now = new Date();
    if (promotion.startsAt > now || promotion.endsAt < now) {
      return false;
    }

    const completedOrders = await this.prisma.order.count({
      where: {
        userId: userId,
        promotionCode: promotionCode,
      },
    });

    return completedOrders === 0;
  }

  async listEligiblePromotionsByUserId(userId: string) {
    const activePromotions = await this.prisma.promotion.findMany({
      select: {
        isActive: true,
        startsAt: true,
        endsAt: true,
        code: true,
        description: true,
        orders: {
          select: { userId: true },
          where: { userId: userId },
        },
      },
      where: {
        isActive: true,
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
        orders: {
          none: {
            userId: userId,
          },
        },
      },
      orderBy: { endsAt: 'asc' },
    });

    return activePromotions;
  }
}
