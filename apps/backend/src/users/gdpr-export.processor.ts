import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import AdmZip from 'adm-zip';
import { Resend } from 'resend';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { S3Service } from '../admin/s3.service.js';
import { escapeHtml } from '../common/utils/escape-html.util.js';

interface GdprExportJobData {
  userId: string;
}

@Processor('gdpr-export')
export class GdprExportProcessor extends WorkerHost {
  private readonly logger = new Logger(GdprExportProcessor.name);
  private readonly resend?: Resend;
  private readonly emailFrom: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly config: ConfigService,
  ) {
    super();
    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = resendApiKey ? new Resend(resendApiKey) : undefined;
    this.emailFrom =
      this.config.get<string>('RESEND_FROM_EMAIL') ??
      'Crafty Bass <onboarding@resend.dev>';
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  async process(job: Job<GdprExportJobData>): Promise<{ fileKey: string }> {
    const { userId } = job.data;
    this.logger.log(`Processing GDPR export job ${job.id} for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true,
        sessions: true,
        consents: true,
        homeownerProfile: true,
        tradesmanProfile: {
          include: { skills: { include: { skill: true } } },
        },
        postedJobs: {
          include: {
            quotes: true,
            skills: { include: { skill: true } },
            reviews: true,
            recommendations: true,
          },
        },
        assignedJobs: { select: { id: true, status: true, completedAt: true } },
        quotes: true,
        sentMessages: true,
        receivedMessages: true,
        reviewsGiven: true,
        reviewsReceived: true,
        createdReports: true,
        assignedReports: true,
        recommendations: true,
        conversationLinks: {
          include: {
            conversation: { select: { id: true, type: true, jobId: true } },
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found — skipping GDPR export`);
      return { fileKey: '' };
    }

    const zip = new AdmZip();
    zip.addFile(
      'user_data.json',
      Buffer.from(JSON.stringify(user, null, 2), 'utf8'),
    );
    zip.addFile(
      'README.txt',
      Buffer.from(
        [
          'Crafty Bass — GDPR Data Export',
          `Generated for user: ${user.id}`,
          `Generated at: ${new Date().toISOString()}`,
          '',
          'This archive contains every record we hold against your account at',
          'the moment the export was generated. Subsequent activity is not',
          'included.',
        ].join('\n'),
        'utf8',
      ),
    );
    const zipBuffer = zip.toBuffer();

    const fileKey = `gdpr-exports/${userId}-${Date.now()}.zip`;
    await this.s3Service.uploadObject(fileKey, zipBuffer, 'application/zip');

    await this.sendReadyEmail(user.email, user.name);

    this.logger.log(
      `GDPR export job ${job.id} completed for user ${userId} (s3 key: ${fileKey})`,
    );
    return { fileKey };
  }

  private async sendReadyEmail(email: string, name: string): Promise<void> {
    if (!this.resend || !email) {
      this.logger.warn(
        'Resend is not configured — skipping GDPR export ready email.',
      );
      return;
    }

    const privacyLink = `${this.frontendUrl}/account/privacy`;
    const safeName = escapeHtml(name);
    const safePrivacyLink = escapeHtml(privacyLink);

    try {
      await this.resend.emails.send({
        to: email,
        from: this.emailFrom,
        subject: 'Your data export is ready — Crafty Bass',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Your data export is ready</h2>
            <p>Hi ${safeName},</p>
            <p>The data export you requested has finished. You can download it from the Privacy section of your account:</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${safePrivacyLink}" style="background-color: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Open Privacy Settings
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">For your protection the export is kept for 24 hours and then deleted automatically. Each download link is generated on demand and is bound to your signed-in session.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send GDPR export ready email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
