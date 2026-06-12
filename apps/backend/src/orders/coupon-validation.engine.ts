import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  Coupon,
  CouponDiscountType,
  Prisma,
  PrismaClient,
} from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';

interface CouponValidationOptions {
  userId: string;
  code: string;
  subtotalAmount: number;
  tx?: Prisma.TransactionClient;
  reserveUsage?: boolean;
}

export interface CouponValidationResult {
  couponId: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  discountAmount: number;
  subtotalAmount: number;
  totalAmount: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  endsAt: Date | null;
}

@Injectable()
export class CouponValidationEngine {
  constructor(private readonly prisma: PrismaService) {}

  normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private getClient(
    tx?: Prisma.TransactionClient,
  ): PrismaClient | Prisma.TransactionClient {
    return tx ?? this.prisma;
  }

  private toMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toDecimalNumber(
    value: Prisma.Decimal | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    return Number(value);
  }

  private calculateDiscount(subtotalAmount: number, coupon: Coupon): number {
    const discountValue = Number(coupon.discountValue);
    let discountAmount =
      coupon.discountType === 'PERCENTAGE'
        ? (subtotalAmount * discountValue) / 100
        : discountValue;

    if (coupon.maxDiscountAmount !== null) {
      discountAmount = Math.min(
        discountAmount,
        Number(coupon.maxDiscountAmount),
      );
    }

    discountAmount = Math.max(0, Math.min(discountAmount, subtotalAmount));
    return this.toMoney(discountAmount);
  }

  async validate(
    options: CouponValidationOptions,
  ): Promise<CouponValidationResult> {
    const client = this.getClient(options.tx);
    const code = this.normalizeCode(options.code);
    const subtotalAmount = this.toMoney(options.subtotalAmount);

    if (!code) {
      throw new BadRequestException('Coupon code is required');
    }

    if (subtotalAmount <= 0) {
      throw new BadRequestException('Subtotal must be greater than zero');
    }

    const coupon = await client.coupon.findUnique({
      where: { code },
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid coupon code');
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('Coupon is not active yet');
    }

    if (coupon.endsAt && coupon.endsAt < now) {
      throw new BadRequestException('Coupon has expired');
    }

    if (
      coupon.minOrderAmount !== null &&
      subtotalAmount < Number(coupon.minOrderAmount)
    ) {
      throw new BadRequestException(
        `Minimum order amount for this coupon is ${Number(coupon.minOrderAmount).toFixed(2)}`,
      );
    }

    if (coupon.usageLimitPerUser !== null) {
      const userUsageCount = await client.order.count({
        where: {
          userId: options.userId,
          couponId: coupon.id,
          status: { not: 'CANCELLED' },
        },
      });

      if (userUsageCount >= coupon.usageLimitPerUser) {
        throw new BadRequestException(
          'You have reached the usage limit for this coupon',
        );
      }
    }

    if (coupon.usageLimit !== null) {
      if (options.reserveUsage) {
        const reservation = await client.coupon.updateMany({
          where: {
            id: coupon.id,
            usedCount: { lt: coupon.usageLimit },
          },
          data: {
            usedCount: { increment: 1 },
          },
        });

        if (reservation.count === 0) {
          throw new BadRequestException('Coupon usage limit reached');
        }
      } else if (coupon.usedCount >= coupon.usageLimit) {
        throw new BadRequestException('Coupon usage limit reached');
      }
    }

    const discountAmount = this.calculateDiscount(subtotalAmount, coupon);
    const totalAmount = this.toMoney(subtotalAmount - discountAmount);

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount,
      subtotalAmount,
      totalAmount,
      minOrderAmount: this.toDecimalNumber(coupon.minOrderAmount),
      maxDiscountAmount: this.toDecimalNumber(coupon.maxDiscountAmount),
      endsAt: coupon.endsAt,
    };
  }
}
