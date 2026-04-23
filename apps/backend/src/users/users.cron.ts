import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersCronService {
  private readonly logger = new Logger(UsersCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs daily at midnight to permanently delete users whose
   * deletionScheduledAt date has passed (30-day GDPR retention window).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleScheduledDeletions() {
    const now = new Date();

    const usersToDelete = await this.prisma.user.findMany({
      where: {
        deletionScheduledAt: { lte: now },
      },
      select: { id: true, email: true },
    });

    if (usersToDelete.length === 0) {
      this.logger.log('No users scheduled for deletion.');
      return;
    }

    this.logger.warn(
      `Found ${usersToDelete.length} user(s) scheduled for deletion. Processing...`,
    );

    for (const user of usersToDelete) {
      try {
        // Instead of permanently deleting, anonymize personal data and perform a soft-delete
        // This preserves non-PII records required for accounting while removing personal identifiers
        await this.prisma.$transaction(async (tx) => {
          // Remove support-related PII-bearing records
          await tx.ticketMessage.deleteMany({ where: { senderId: user.id } });
          await tx.supportTicket.deleteMany({ where: { userId: user.id } });
          await tx.supportTicket.deleteMany({
            where: { assignedToId: user.id },
          });

          // Notifications & audit logs
          await tx.notification.deleteMany({ where: { userId: user.id } });
          await tx.auditLog.deleteMany({ where: { userId: user.id } });

          // Delete reviews authored by the user (these contain free text)
          await tx.review.deleteMany({ where: { userId: user.id } });

          // Wishlist
          const wishlist = await tx.wishlist.findUnique({
            where: { userId: user.id },
            select: { id: true },
          });
          if (wishlist) {
            await tx.wishlistItem.deleteMany({
              where: { wishlistId: wishlist.id },
            });
            await tx.wishlist.delete({ where: { id: wishlist.id } });
          }

          // Cart
          const cart = await tx.cart.findUnique({
            where: { userId: user.id },
            select: { id: true },
          });
          if (cart) {
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
            await tx.cart.delete({ where: { id: cart.id } });
          }

          // Orders: keep order records for accounting, but anonymize any PII in shippingAddress
          const orders = await tx.order.findMany({
            where: { userId: user.id },
            select: { id: true },
          });
          const orderIds = orders.map((o) => o.id);
          if (orderIds.length > 0) {
            await tx.order.updateMany({
              where: { id: { in: orderIds } },
              data: { shippingAddress: {} as Prisma.InputJsonValue },
            });

            // Mask gateway responses for related payments
            await tx.payment.updateMany({
              where: { orderId: { in: orderIds } },
              data: {
                gatewayResponse: {
                  _pii_masked: true,
                  maskedAt: new Date().toISOString(),
                } as Prisma.InputJsonValue,
              },
            });
          }

          // Auth-related cleanup
          await tx.session.deleteMany({ where: { userId: user.id } });
          await tx.account.deleteMany({ where: { userId: user.id } });

          // Remove GDPR-related consent records and other PII stores
          await tx.userConsent.deleteMany({ where: { userId: user.id } });

          // Finally anonymize the user row itself (soft-delete by clearing identifiers)
          const anonymizedEmail = `deleted+${user.id}@anonymized.invalid`;

          await tx.user.update({
            where: { id: user.id },
            data: {
              name: 'Deleted User',
              email: anonymizedEmail,
              emailVerified: false,
              image: null,
              phone: null,
              shippingAddress: Prisma.DbNull,
              paymentPreferences: Prisma.DbNull,
              stripeCustomerId: null,
              deletionScheduledAt: null,
              banned: true,
              banReason: 'GDPR deletion processed',
            },
          });
        });

        this.logger.log(
          `Anonymized and soft-deleted user ${user.id} (${user.email})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to anonymize user ${user.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
