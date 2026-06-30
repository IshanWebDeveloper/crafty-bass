import { Injectable, Logger } from '@nestjs/common';
import type { Notification } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { EmailService } from '../common/services/email.service.js';
import { escapeHtml } from '../common/utils/index.js';

// Tradesmen are warned this far ahead of a job's `expiresAt`. Mirrors the
// frontend "expiring soon" window (apps/frontend/src/lib/job-expiry.ts) so the
// red board pill and the notification fire together.
const EXPIRY_NOTICE_LEAD_MS = 48 * 60 * 60 * 1000;

// Map a tradesman's preferred language to the frontend locale segment used in
// email deep links (in-app links are locale-agnostic — the client prefixes the
// active locale).
const LOCALE_BY_LANGUAGE: Record<string, string> = {
  EN: 'en',
  SI: 'si',
  TA: 'ta',
};

export type NotificationDto = {
  id: string;
  type: Notification['type'];
  title: string;
  body: string | null;
  href: string | null;
  jobId: string | null;
  read: boolean;
  createdAt: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** The user's most recent notifications, newest first. */
  async listForUser(userId: string, take = 50): Promise<NotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((n) => this.toDto(n));
  }

  /** Count of the user's unread notifications (drives the bell badge). */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  /** Marks one notification read. Scoped by userId so a user can't touch another's. */
  async markRead(userId: string, id: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Marks all of the user's unread notifications read. */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /**
   * Finds OPEN jobs entering their final stretch before `expiresAt` and, for
   * each, notifies the tradesmen who could still quote — an in-app notification
   * plus a best-effort email. Runs once per job (guarded by
   * `Job.expiryNoticeSentAt`). Called by JobExpiryNoticeCronService.
   *
   * "Relevant" = an available tradesman whose skills overlap the job's category
   * or listed skills, in the same district (when the job has one), who hasn't
   * already quoted the job. Returns how many jobs were processed.
   */
  async dispatchJobExpiryNotices(): Promise<number> {
    const now = new Date();
    const horizon = new Date(now.getTime() + EXPIRY_NOTICE_LEAD_MS);

    const jobs = await this.prisma.job.findMany({
      where: {
        status: 'OPEN',
        expiryNoticeSentAt: null,
        expiresAt: { gt: now, lte: horizon },
      },
      select: {
        id: true,
        title: true,
        district: true,
        categoryId: true,
        expiresAt: true,
        skills: { select: { skillId: true } },
      },
    });

    for (const job of jobs) {
      try {
        await this.noticeOneJob(job, now);
      } catch (error) {
        // Keep the batch going — a single bad job shouldn't stall the cron.
        this.logger.error(
          `Failed to dispatch expiry notices for job ${job.id}: ${
            error instanceof Error
              ? error.stack || error.message
              : String(error)
          }`,
        );
      }
    }

    return jobs.length;
  }

  private async noticeOneJob(
    job: {
      id: string;
      title: string;
      district: string | null;
      categoryId: string | null;
      expiresAt: Date | null;
      skills: { skillId: string }[];
    },
    now: Date,
  ): Promise<void> {
    const skillIds = job.skills.map((s) => s.skillId);
    const skillMatch: Array<
      { skill: { categoryId: string } } | { skillId: { in: string[] } }
    > = [];
    if (job.categoryId)
      skillMatch.push({ skill: { categoryId: job.categoryId } });
    if (skillIds.length) skillMatch.push({ skillId: { in: skillIds } });

    // Nothing to match on (job has no category and no skills): mark it noticed so
    // we don't re-scan it every hour, and move on.
    const recipients =
      skillMatch.length === 0
        ? []
        : await this.prisma.tradesmanProfile.findMany({
            where: {
              isAvailable: true,
              ...(job.district ? { district: job.district } : {}),
              skills: { some: { OR: skillMatch } },
              user: {
                // Tradesmen only — JOB_EXPIRING is a tradesman-audience notice;
                // homeowners never receive "a nearby job is expiring". (Only
                // tradesmen have a tradesmanProfile, so this is also explicit
                // belt-and-braces against ever notifying the wrong audience.)
                userType: 'TRADESMAN',
                // Skip tradesmen who already quoted — they haven't missed it.
                quotes: { none: { jobId: job.id } },
              },
            },
            select: {
              preferredLanguage: true,
              user: { select: { id: true, email: true, name: true } },
            },
          });

    if (recipients.length > 0) {
      const hoursLeft = job.expiresAt
        ? Math.max(
            1,
            Math.ceil((job.expiresAt.getTime() - now.getTime()) / 3_600_000),
          )
        : 1;
      const where = job.district ? ` in ${job.district}` : '';
      const title = 'A job near you is closing soon';
      const body = `"${job.title}"${where} expires in about ${hoursLeft}h. Send your quote before it closes.`;
      const href = `jobs/${job.id}`;

      await this.prisma.notification.createMany({
        data: recipients.map((r) => ({
          userId: r.user.id,
          type: 'JOB_EXPIRING' as const,
          title,
          body,
          href,
          jobId: job.id,
        })),
        skipDuplicates: true,
      });

      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      await Promise.all(
        recipients.map((r) => {
          const locale = LOCALE_BY_LANGUAGE[r.preferredLanguage] ?? 'en';
          return this.email.send({
            to: r.user.email,
            subject: 'A job is about to expire — Crafty Bass',
            html: this.expiryEmailHtml({
              name: r.user.name,
              jobTitle: job.title,
              district: job.district,
              hoursLeft,
              link: `${frontendUrl}/${locale}/jobs/${job.id}`,
            }),
          });
        }),
      );

      this.logger.log(
        `Notified ${recipients.length} tradesman(s) about expiring job ${job.id}.`,
      );
    }

    // Mark processed regardless of recipient count so the cron is one-shot.
    await this.prisma.job.update({
      where: { id: job.id },
      data: { expiryNoticeSentAt: now },
    });
  }

  private expiryEmailHtml(opts: {
    name: string;
    jobTitle: string;
    district: string | null;
    hoursLeft: number;
    link: string;
  }): string {
    const name = escapeHtml(opts.name);
    const jobTitle = escapeHtml(opts.jobTitle);
    const where = opts.district ? ` in ${escapeHtml(opts.district)}` : '';
    const link = escapeHtml(opts.link);
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>A job is about to expire</h2>
        <p>Hi ${name},</p>
        <p>An open job matching your trade is closing soon:</p>
        <p style="font-size: 16px; font-weight: bold; margin: 16px 0 4px;">${jobTitle}${where}</p>
        <p style="color: #b91c1c;">Expires in about ${opts.hoursLeft} hour(s).</p>
        <p>Send your quote before it closes so you don't miss the opportunity.</p>
        <p style="margin-top: 24px;">
          <a href="${link}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px;">View the job</a>
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">You're receiving this because your Crafty Bass trade and area match this job.</p>
      </div>
    `;
  }

  private toDto(n: Notification): NotificationDto {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      jobId: n.jobId,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
