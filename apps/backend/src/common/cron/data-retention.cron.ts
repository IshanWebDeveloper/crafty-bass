import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Data retention cron jobs for UK GDPR compliance.
 * Runs scheduled cleanup tasks to enforce data retention policies.
 */
@Injectable()
export class DataRetentionCronService {
  private readonly logger = new Logger(DataRetentionCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Delete read notifications older than 90 days.
   * Runs daily at 1:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanupOldNotifications() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const result = await this.prisma.notification.deleteMany({
      where: {
        readAt: { not: null, lte: cutoff },
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Cleaned up ${result.count} read notification(s) older than 90 days.`,
      );
    }
  }

  /**
   * Delete audit logs older than 2 years.
   * Runs weekly on Sunday at 2:00 AM.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldAuditLogs() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 2);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lte: cutoff },
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Cleaned up ${result.count} audit log(s) older than 2 years.`,
      );
    }
  }

  /**
   * Delete expired sessions (better-auth sessions).
   * Runs daily at 3:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredSessions() {
    const now = new Date();

    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired session(s).`);
    }
  }

  /**
   * Mask PII in payment gateway responses older than 6 months.
   * Runs monthly at 4:00 AM.
   */
  @Cron('0 4 1 * *')
  async maskOldPaymentGatewayResponses() {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);

    // Prisma doesn't support bulk updates with dynamic JSON values easily without raw SQL
    // if we need to inspect the JSON. But if we just overwrite it with a standard masked object:
    const result = await this.prisma.payment.updateMany({
      where: {
        createdAt: { lte: cutoff },
      },
      data: {
        gatewayResponse: {
          _pii_masked: true,
          maskedAt: new Date().toISOString(),
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Masked PII in gatewayResponse for ${result.count} payment(s) older than 6 months.`,
      );
    }
  }
}
