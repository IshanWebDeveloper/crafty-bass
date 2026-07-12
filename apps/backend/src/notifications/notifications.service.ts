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
// email deep links (in-app links are locale-agnostic - the client prefixes the
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

// A row to be inserted by the lifecycle dispatch methods below.
type NotificationRow = {
  userId: string;
  type: Notification['type'];
  title: string;
  body?: string | null;
  href?: string | null;
  jobId?: string | null;
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

  // --- Job-lifecycle status notifications (notes-outline #40) ------------------
  //
  // Each method below is dispatched by the service that owns a transition
  // (quotes accept, escrow fund/start/complete/approve, job cancel, expiry cron)
  // once that transition has committed. They are all **best-effort**: any failure
  // is swallowed and logged so a notification never breaks the underlying
  // marketplace action. In-app only - the `@@unique([userId, type, jobId])`
  // constraint keeps each event one-per-recipient-per-job (createMany skips dups).

  /**
   * Quote accepted → job assigned. Tells the winning tradesman they got the job
   * and the tradesmen whose quotes were just rejected that they weren't picked.
   */
  async notifyQuoteDecision(
    jobId: string,
    acceptedTradesmanId: string,
  ): Promise<void> {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: {
          title: true,
          quotes: { select: { tradesmanId: true, status: true } },
        },
      });
      if (!job) return;
      const href = `jobs/${jobId}`;
      const rows: NotificationRow[] = [
        {
          userId: acceptedTradesmanId,
          type: 'QUOTE_ACCEPTED',
          title: 'Your quote was accepted',
          body: `You've been hired for "${job.title}". You'll be notified once the homeowner funds the deposit.`,
          href,
          jobId,
        },
      ];
      const losers = [
        ...new Set(
          job.quotes
            .filter(
              (q) =>
                q.status === 'REJECTED' &&
                q.tradesmanId !== acceptedTradesmanId,
            )
            .map((q) => q.tradesmanId),
        ),
      ];
      for (const tradesmanId of losers) {
        rows.push({
          userId: tradesmanId,
          type: 'QUOTE_DECLINED',
          title: "Your quote wasn't selected",
          body: `The homeowner chose another tradesperson for "${job.title}".`,
          href,
          jobId,
        });
      }
      await this.createNotifications(rows);
    } catch (error) {
      this.logNotifyFailure('quote decision', jobId, error);
    }
  }

  /** Deposit funded → tell the assigned tradesman they can start. */
  async notifyEscrowFunded(jobId: string): Promise<void> {
    await this.notifyOne(jobId, 'assignedTradesman', {
      type: 'ESCROW_FUNDED',
      title: 'Deposit funded - you can start',
      body: (title) =>
        `The homeowner funded the deposit for "${title}". You can begin the work.`,
    });
  }

  /** Tradesman started work (job → IN_PROGRESS) → tell the homeowner. */
  async notifyWorkStarted(jobId: string): Promise<void> {
    await this.notifyOne(jobId, 'homeowner', {
      type: 'WORK_STARTED',
      title: 'Work has started',
      body: (title) => `The tradesperson has started work on "${title}".`,
    });
  }

  /** Tradesman marked work done → tell the homeowner to review and approve. */
  async notifyWorkSubmitted(jobId: string): Promise<void> {
    await this.notifyOne(jobId, 'homeowner', {
      type: 'WORK_COMPLETED',
      title: 'Work marked complete',
      body: (title) =>
        `The tradesperson marked "${title}" complete. Review and approve to release the balance.`,
    });
  }

  /** Homeowner approved → balance released → tell the tradesman they were paid. */
  async notifyJobCompleted(jobId: string): Promise<void> {
    await this.notifyOne(jobId, 'assignedTradesman', {
      type: 'JOB_COMPLETED',
      title: 'Payment released',
      body: (title) =>
        `The homeowner approved "${title}". The balance has been released to you.`,
    });
  }

  /** Job cancelled → tell the assigned tradesman (no-op if none was assigned). */
  async notifyJobCancelled(jobId: string): Promise<void> {
    await this.notifyOne(jobId, 'assignedTradesman', {
      type: 'JOB_CANCELLED',
      title: 'Job cancelled',
      body: (title) => `The homeowner cancelled "${title}".`,
    });
  }

  /**
   * Support resolved a dispute: the job was cancelled and some/all of the
   * deposit refunded. Tells both parties the outcome. Reuses the JOB_CANCELLED
   * type (the job is being cancelled) with dispute-specific copy - a disputed
   * job can't have been cancelled before, so the per-job unique constraint
   * never suppresses these.
   */
  async notifyDisputeResolved(
    jobId: string,
    opts: { refundAmount: number; currency: string },
  ): Promise<void> {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, homeownerId: true, assignedTradesmanId: true },
      });
      if (!job) return;
      const href = `jobs/${jobId}`;
      const refunded =
        opts.refundAmount > 0
          ? `${opts.currency} ${opts.refundAmount.toLocaleString('en-LK')}`
          : null;
      const rows: NotificationRow[] = [
        {
          userId: job.homeownerId,
          type: 'JOB_CANCELLED',
          title: 'Dispute resolved',
          body: refunded
            ? `Our team reviewed your report on "${job.title}", cancelled the job and refunded ${refunded} to you.`
            : `Our team reviewed your report on "${job.title}" and cancelled the job. No refund was issued.`,
          href,
          jobId,
        },
      ];
      if (job.assignedTradesmanId) {
        rows.push({
          userId: job.assignedTradesmanId,
          type: 'JOB_CANCELLED',
          title: 'Job cancelled after review',
          body: refunded
            ? `Following a dispute, our team cancelled "${job.title}" and refunded ${refunded} of the deposit to the homeowner.`
            : `Following a dispute, our team cancelled "${job.title}".`,
          href,
          jobId,
        });
      }
      await this.createNotifications(rows);
    } catch (error) {
      this.logNotifyFailure('dispute resolved', jobId, error);
    }
  }

  /**
   * Open jobs that lapsed to EXPIRED → tell each homeowner their job expired.
   * Batched: the expiry cron passes the jobs it just expired.
   */
  async notifyJobsExpired(
    jobs: Array<{ id: string; title: string; homeownerId: string }>,
  ): Promise<void> {
    if (jobs.length === 0) return;
    await this.createNotifications(
      jobs.map((job) => ({
        userId: job.homeownerId,
        type: 'JOB_EXPIRED',
        title: 'Your job expired',
        body: `"${job.title}" expired without being assigned. You can repost it anytime.`,
        href: `jobs/${job.id}`,
        jobId: job.id,
      })),
    );
  }

  // Notifies exactly one party (the job's homeowner or its assigned tradesman)
  // about a job-lifecycle event. Best-effort.
  private async notifyOne(
    jobId: string,
    recipient: 'homeowner' | 'assignedTradesman',
    copy: {
      type: Notification['type'];
      title: string;
      body: (title: string) => string;
    },
  ): Promise<void> {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, homeownerId: true, assignedTradesmanId: true },
      });
      if (!job) return;
      const userId =
        recipient === 'homeowner' ? job.homeownerId : job.assignedTradesmanId;
      if (!userId) return;
      await this.createNotifications([
        {
          userId,
          type: copy.type,
          title: copy.title,
          body: copy.body(job.title),
          href: `jobs/${jobId}`,
          jobId,
        },
      ]);
    } catch (error) {
      this.logNotifyFailure(copy.type, jobId, error);
    }
  }

  private async createNotifications(rows: NotificationRow[]): Promise<void> {
    if (rows.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: rows.map((r) => ({
          userId: r.userId,
          type: r.type,
          title: r.title,
          body: r.body ?? null,
          href: r.href ?? null,
          jobId: r.jobId ?? null,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      this.logNotifyFailure('create', rows[0]?.jobId ?? null, error);
    }
  }

  private logNotifyFailure(
    kind: string,
    jobId: string | null,
    error: unknown,
  ): void {
    this.logger.error(
      `Failed to send ${kind} notification${jobId ? ` for job ${jobId}` : ''}: ${
        error instanceof Error ? error.stack || error.message : String(error)
      }`,
    );
  }

  /**
   * Finds OPEN jobs entering their final stretch before `expiresAt` and, for
   * each, notifies the tradesmen who could still quote - an in-app notification
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
        // Keep the batch going - a single bad job shouldn't stall the cron.
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
                // Tradesmen only - JOB_EXPIRING is a tradesman-audience notice;
                // homeowners never receive "a nearby job is expiring". (Only
                // tradesmen have a tradesmanProfile, so this is also explicit
                // belt-and-braces against ever notifying the wrong audience.)
                userType: 'TRADESMAN',
                // Skip tradesmen who already quoted - they haven't missed it.
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
            subject: 'A job is about to expire - Crafty Bass',
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
