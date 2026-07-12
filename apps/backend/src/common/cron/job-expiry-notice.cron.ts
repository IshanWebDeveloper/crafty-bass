import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../../notifications/notifications.service.js';

/**
 * Warns relevant tradesmen that an OPEN job matching their trade is about to
 * expire, so they can prioritise their quotes before it lapses (see
 * notes-outline #19). Complements JobExpiryCronService, which flips already-
 * lapsed jobs to EXPIRED — this one fires *ahead* of expiry, once per job.
 *
 * The matching + dispatch (in-app notification + email) lives in
 * NotificationsService; this just schedules it hourly.
 */
@Injectable()
export class JobExpiryNoticeCronService {
  private readonly logger = new Logger(JobExpiryNoticeCronService.name);

  constructor(private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async notifyExpiringJobs() {
    const processed = await this.notifications.dispatchJobExpiryNotices();
    if (processed > 0) {
      this.logger.log(`Processed expiry notices for ${processed} job(s).`);
    }
  }
}
