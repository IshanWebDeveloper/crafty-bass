import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service.js';

interface EvaluatePromotionDiscountInput {
  promotionId: string;
  userId: string;
  userRole: Role;
  subtotalAmount: number;
  initialDiscountAmount: number;
  tx?: Prisma.TransactionClient;
}

type PromotionRuleRecord = {
  ruleType:
    | 'MIN_SUBTOTAL'
    | 'MAX_DISCOUNT'
    | 'TOTAL_USAGE_LIMIT'
    | 'PER_USER_USAGE_LIMIT'
    | 'ALLOWED_ROLE';
  decimalValue: Prisma.Decimal | null;
  intValue: number | null;
  stringValue: string | null;
  isActive: boolean;
};

@Injectable()
export class PromotionRuleEngine {
  constructor(private readonly prisma: PrismaService) {}

  private toMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toDecimalNumber(value: Prisma.Decimal | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }

  private getRulePriority(ruleType: PromotionRuleRecord['ruleType']): number {
    switch (ruleType) {
      case 'MIN_SUBTOTAL':
        return 500;
      case 'ALLOWED_ROLE':
        return 400;
      case 'TOTAL_USAGE_LIMIT':
        return 300;
      case 'PER_USER_USAGE_LIMIT':
        return 200;
      case 'MAX_DISCOUNT':
        return 100;
      default:
        return 0;
    }
  }

  private sortRulesDeterministically(rules: PromotionRuleRecord[]) {
    return [...rules].sort((a, b) => {
      const priorityDelta =
        this.getRulePriority(b.ruleType) - this.getRulePriority(a.ruleType);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return a.ruleType.localeCompare(b.ruleType);
    });
  }

  async evaluatePromotionDiscount(
    input: EvaluatePromotionDiscountInput,
  ): Promise<number> {
    const client = input.tx ?? this.prisma;

    const promotion = await client.promotion.findUnique({
      where: { id: input.promotionId },
      select: {
        id: true,
        rules: {
          where: { isActive: true },
          select: {
            ruleType: true,
            decimalValue: true,
            intValue: true,
            stringValue: true,
            isActive: true,
          },
        },
      },
    });

    if (!promotion) {
      throw new BadRequestException('Promotion not found');
    }

    let discountAmount = this.toMoney(
      Math.max(0, Math.min(input.initialDiscountAmount, input.subtotalAmount)),
    );

    const orderedRules = this.sortRulesDeterministically(
      promotion.rules as PromotionRuleRecord[],
    );

    for (const rule of orderedRules) {
      switch (rule.ruleType) {
        case 'MIN_SUBTOTAL': {
          const minimumSubtotal = this.toDecimalNumber(rule.decimalValue);
          if (minimumSubtotal > 0 && input.subtotalAmount < minimumSubtotal) {
            throw new BadRequestException(
              `Minimum order amount for this promotion is ${minimumSubtotal.toFixed(2)}`,
            );
          }
          break;
        }

        case 'ALLOWED_ROLE': {
          const allowedRole = rule.stringValue?.trim().toUpperCase();
          if (allowedRole && input.userRole !== allowedRole) {
            throw new BadRequestException(
              'Your account is not eligible for this promotion',
            );
          }
          break;
        }

        case 'TOTAL_USAGE_LIMIT': {
          const usageLimit = rule.intValue ?? 0;
          if (usageLimit <= 0) {
            break;
          }

          const usedCount = await client.order.count({
            where: {
              promotionId: input.promotionId,
              status: { not: 'CANCELLED' },
            },
          });

          if (usedCount >= usageLimit) {
            throw new BadRequestException('Promotion usage limit reached');
          }
          break;
        }

        case 'PER_USER_USAGE_LIMIT': {
          const perUserLimit = rule.intValue ?? 0;
          if (perUserLimit <= 0) {
            break;
          }

          const usedByUser = await client.order.count({
            where: {
              promotionId: input.promotionId,
              userId: input.userId,
              status: { not: 'CANCELLED' },
            },
          });

          if (usedByUser >= perUserLimit) {
            throw new BadRequestException(
              'You have reached the usage limit for this promotion',
            );
          }
          break;
        }

        case 'MAX_DISCOUNT': {
          const maxDiscount = this.toDecimalNumber(rule.decimalValue);
          if (maxDiscount > 0) {
            discountAmount = this.toMoney(
              Math.min(discountAmount, maxDiscount),
            );
          }
          break;
        }

        default:
          break;
      }
    }

    return this.toMoney(
      Math.max(0, Math.min(discountAmount, input.subtotalAmount)),
    );
  }
}
