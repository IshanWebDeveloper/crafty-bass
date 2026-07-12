import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';

/**
 * Lapses OPEN jobs whose `expiresAt` has passed to EXPIRED so the board only
 * shows work that's still actionable. `expiresAt` is set from urgency when the
 * job is posted (see JobsService). Runs hourly; jobs without an `expiresAt`
 * (pre-dating the field) are left untouched. Each homeowner whose job just
 * lapsed is notified so they can repost.
 */
@Injectable()
export class JobExpiryCronService {
  private readonly logger = new Logger(JobExpiryCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireLapsedJobs() {
    // Grab the jobs about to lapse first (updateMany can't return rows) so we
    // know which homeowners to notify.
    const lapsing = await this.prisma.job.findMany({
      where: { status: 'OPEN', expiresAt: { lte: new Date() } },
      select: { id: true, title: true, homeownerId: true },
    });
    if (lapsing.length === 0) return;

    await this.prisma.job.updateMany({
      where: { id: { in: lapsing.map((j) => j.id) } },
      data: { status: 'EXPIRED' },
    });
    await this.notifications.notifyJobsExpired(lapsing);

    this.logger.log(`Expired ${lapsing.length} lapsed open job(s).`);
  }
}
