import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Lapses OPEN jobs whose `expiresAt` has passed to EXPIRED so the board only
 * shows work that's still actionable. `expiresAt` is set from urgency when the
 * job is posted (see JobsService). Runs hourly; jobs without an `expiresAt`
 * (pre-dating the field) are left untouched.
 */
@Injectable()
export class JobExpiryCronService {
  private readonly logger = new Logger(JobExpiryCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireLapsedJobs() {
    const result = await this.prisma.job.updateMany({
      where: { status: 'OPEN', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} lapsed open job(s).`);
    }
  }
}
