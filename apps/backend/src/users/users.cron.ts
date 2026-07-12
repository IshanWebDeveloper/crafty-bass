import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service.js';

@Injectable()
export class UsersCronService {
  private readonly logger = new Logger(UsersCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs daily at midnight to permanently anonymize users whose
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
        // Anonymize personal data and soft-delete the account. Retargeted from
        // the deleted e-commerce models onto the marketplace schema.
        await this.prisma.$transaction(async (tx) => {
          // Free-text / PII-bearing records authored by or about the user.
          await tx.message.deleteMany({ where: { senderId: user.id } });
          await tx.review.deleteMany({
            where: {
              OR: [{ reviewerId: user.id }, { revieweeId: user.id }],
            },
          });
          await tx.report.deleteMany({ where: { reporterId: user.id } });

          // Profiles carry contact/location PII (address, bio, etc.).
          await tx.homeownerProfile.deleteMany({ where: { userId: user.id } });
          await tx.tradesmanProfile.deleteMany({ where: { userId: user.id } });

          // GDPR consent records + auth material.
          await tx.userConsent.deleteMany({ where: { userId: user.id } });
          await tx.session.deleteMany({ where: { userId: user.id } });
          await tx.account.deleteMany({ where: { userId: user.id } });

          // TODO(Phase C: GDPR): decide the retention/anonymization policy for
          // the user's Jobs, Quotes, and Conversations. These reference the
          // counterparty and may need to be preserved (and PII-stripped) rather
          // than deleted outright - flagged as ambiguous during the legacy sweep.

          // Finally anonymize the user row itself (soft-delete).
          const anonymizedEmail = `deleted+${user.id}@anonymized.invalid`;

          await tx.user.update({
            where: { id: user.id },
            data: {
              name: 'Deleted User',
              email: anonymizedEmail,
              emailVerified: false,
              image: null,
              phone: null,
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
