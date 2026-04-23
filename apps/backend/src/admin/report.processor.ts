import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { PdfService } from './pdf.service.js';
import { S3Service } from './s3.service.js';

interface ReportJobData {
  userId: string;
  startDate?: string;
  endDate?: string;
}

@Processor('reports')
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly s3Service: S3Service,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<{ url: string }> {
    this.logger.log(
      `Processing report job ${job.id} for user ${job.data.userId}`,
    );

    // 1. Build query filter
    const where: Record<string, unknown> = {};
    if (job.data.startDate || job.data.endDate) {
      where.createdAt = {
        ...(job.data.startDate && { gte: new Date(job.data.startDate) }),
        ...(job.data.endDate && { lte: new Date(job.data.endDate) }),
      };
    }

    // 2. Get sales data
    const [orders, revenueByStatus] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: true,
        _sum: { totalAmount: true },
      }),
    ]);

    const data = {
      totalOrders: orders.length,
      revenueByStatus: revenueByStatus.map((r) => ({
        status: r.status,
        count: r._count,
        revenue: Number(r._sum.totalAmount ?? 0),
      })),
      orders: orders.slice(0, 50).map((o) => ({
        ...o,
        totalAmount: Number(o.totalAmount),
      })),
    };

    // 3. Generate PDF
    const pdfBuffer = await this.pdfService.generateSalesReportPdf(data);

    // 4. Upload to S3
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const objectKey = `reports/sales/sales-report-${timestamp}.pdf`;
    const downloadUrl = await this.s3Service.uploadAndGetPresignedUrl(
      objectKey,
      pdfBuffer,
    );

    // 5. Notify the requesting admin
    await this.prisma.notification.create({
      data: {
        userId: job.data.userId,
        type: 'SYSTEM',
        title: 'Sales Report Ready',
        body: `Your sales report has been generated and is ready to download. Download URL: ${downloadUrl}`,
      },
    });

    this.logger.log(`Report job ${job.id} completed — uploaded to S3`);
    return { url: downloadUrl };
  }
}
