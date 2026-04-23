import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import AdmZip from 'adm-zip';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { S3Service } from '../admin/s3.service.js';

interface GdprExportJobData {
  userId: string;
}

@Processor('gdpr-export')
export class GdprExportProcessor extends WorkerHost {
  private readonly logger = new Logger(GdprExportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {
    super();
  }

  async process(job: Job<GdprExportJobData>): Promise<{ downloadUrl: string }> {
    const { userId } = job.data;
    this.logger.log(`Processing GDPR export job ${job.id} for user ${userId}`);

    // 1. Fetch all user data
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessions: true,
        accounts: true,
        orders: { include: { items: true } },
        reviews: true,
        wishlist: { include: { items: true } },
        notifications: true,
        auditLogs: true,
        createdTickets: true,
        ticketMessages: true,
      },
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found — skipping GDPR export`);
      return { downloadUrl: '' };
    }

    // 2. Create ZIP
    const jsonData = JSON.stringify(user, null, 2);
    const zip = new AdmZip();
    zip.addFile('user_data.json', Buffer.from(jsonData, 'utf8'));
    const zipBuffer = zip.toBuffer();

    // 3. Upload to S3
    const fileKey = `gdpr-exports/${userId}-${Date.now()}.zip`;
    const downloadUrl = await this.s3Service.uploadAndGetPresignedUrl(
      fileKey,
      zipBuffer,
      'application/zip',
      86400, // 24 hours
    );

    // 4. Notify user
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Data Export Ready',
        body: `Your GDPR data export is ready to download. The link will expire in 24 hours. Download URL: ${downloadUrl}`,
      },
    });

    this.logger.log(`GDPR export job ${job.id} completed for user ${userId}`);
    return { downloadUrl };
  }
}
