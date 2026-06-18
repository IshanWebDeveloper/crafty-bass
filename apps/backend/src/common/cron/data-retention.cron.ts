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

  // TODO(Phase C): the legacy notification/auditLog/payment retention sweeps were
  // removed with their models. Add marketplace retention policies (e.g. pruning
  // old Messages or expired Jobs) once those are defined.
}
