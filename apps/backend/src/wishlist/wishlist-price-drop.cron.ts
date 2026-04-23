import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class WishlistPriceDropCronService {
  private readonly logger = new Logger(WishlistPriceDropCronService.name);
  private readonly alertThreshold = 0.1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private resolveCurrentPrice(input: {
    basePrice: Prisma.Decimal;
    variants: Array<{ price: Prisma.Decimal }>;
  }): number {
    const variantPrice = input.variants[0]?.price;
    const source = variantPrice ?? input.basePrice;
    return this.toMoney(Number(source));
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkPriceDrops() {
    const items = await this.prisma.wishlistItem.findMany({
      where: {
        product: {
          isActive: true,
        },
      },
      include: {
        wishlist: {
          select: {
            userId: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            variants: {
              select: {
                price: true,
              },
              orderBy: { price: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    for (const item of items) {
      if (!item.product) {
        continue;
      }

      const currentPrice = this.resolveCurrentPrice(item.product);
      const trackedPrice = item.trackedPrice ? Number(item.trackedPrice) : null;

      if (trackedPrice === null || trackedPrice <= 0) {
        await this.prisma.wishlistItem.update({
          where: { id: item.id },
          data: { trackedPrice: currentPrice },
        });
        continue;
      }

      if (currentPrice > trackedPrice) {
        await this.prisma.wishlistItem.update({
          where: { id: item.id },
          data: { trackedPrice: currentPrice },
        });
        continue;
      }

      const dropPercent = ((trackedPrice - currentPrice) / trackedPrice) * 100;
      if (dropPercent < this.alertThreshold * 100) {
        continue;
      }

      try {
        await this.notificationsService.createPriceDropAlert({
          userId: item.wishlist.userId,
          productName: item.product.name,
          productSlug: item.product.slug,
          previousPrice: trackedPrice,
          currentPrice,
          dropPercent,
        });

        await this.prisma.wishlistItem.update({
          where: { id: item.id },
          data: {
            trackedPrice: currentPrice,
            lastPriceDropAlertAt: new Date(),
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to process price-drop alert for wishlist item ${item.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
