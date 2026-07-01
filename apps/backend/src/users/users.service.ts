import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Role, UserType } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { UpdateProfileDto, UserListQueryDto } from './dto/index.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import { S3Service } from '../admin/s3.service.js';

const GDPR_EXPORT_DOWNLOAD_TTL_SECONDS = 15 * 60;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('gdpr-export') private readonly gdprExportQueue: Queue,
    private readonly s3Service: S3Service,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: { select: { primaryTrade: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Flatten the tradesman's stated primary trade so the header/own-profile can
    // badge it without a second request.
    const { verification, ...rest } = user;
    return { ...rest, primaryTrade: verification?.primaryTrade ?? null };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
    });
  }

  async getDashboard(userId: string) {
    // Marketplace dashboard: a user's posted jobs (as homeowner), assigned jobs
    // (as tradesman), and the reviews they have received. Replaces the legacy
    // order/wishlist dashboard.
    const ACTIVE_JOB_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] as const;

    const [
      recentPostedJobs,
      totalPostedJobs,
      activePostedJobs,
      assignedJobs,
      reviewsReceived,
    ] = await Promise.all([
      this.prisma.job.findMany({
        where: { homeownerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { category: { select: { nameEn: true, slug: true } } },
      }),
      this.prisma.job.count({ where: { homeownerId: userId } }),
      this.prisma.job.count({
        where: {
          homeownerId: userId,
          status: { in: [...ACTIVE_JOB_STATUSES] },
        },
      }),
      this.prisma.job.count({ where: { assignedTradesmanId: userId } }),
      this.prisma.review.count({ where: { revieweeId: userId } }),
    ]);

    return {
      recentPostedJobs,
      totalPostedJobs,
      activePostedJobs,
      assignedJobs,
      reviewsReceived,
    };
  }

  async listUsers(query: UserListQueryDto) {
    const { page, limit, role, userType, search } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role: role as Role }),
      ...(userType && { userType: userType as UserType }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async updateUserRole(adminId: string, targetUserId: string, role: Role) {
    if (adminId === targetUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
    });
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const job = await this.gdprExportQueue.add('gdpr-export', { userId });

    return {
      jobId: job.id,
      message:
        'Your data export has been queued. You will receive a notification when it is ready to download.',
    };
  }

  async getLatestExportDownloadUrl(userId: string): Promise<{
    downloadUrl: string;
    fileKey: string;
    expiresInSeconds: number;
  }> {
    // The prefix is derived from the authenticated session, not from any
    // request param, so a caller cannot widen the search to another user's
    // exports.
    const prefix = `gdpr-exports/${userId}-`;
    const keys = await this.s3Service.listObjectKeysWithPrefix(prefix);

    if (keys.length === 0) {
      throw new NotFoundException('No data export available for this account');
    }

    // Keys are suffixed with `${Date.now()}.zip`; lexicographic descending sort
    // surfaces the most recent export.
    const latestKey = [...keys].sort().reverse()[0];

    if (!latestKey) {
      throw new NotFoundException('No data export available for this account');
    }

    const downloadUrl = await this.s3Service.getPresignedDownloadUrl(
      latestKey,
      GDPR_EXPORT_DOWNLOAD_TTL_SECONDS,
      'crafty-bass-data-export.zip',
    );

    return {
      downloadUrl,
      fileKey: latestKey,
      expiresInSeconds: GDPR_EXPORT_DOWNLOAD_TTL_SECONDS,
    };
  }

  async scheduleDeletion(userId: string) {
    // Schedule deletion for 30 days from now
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionScheduledAt: deletionDate },
    });

    return {
      message: 'Account scheduled for deletion',
      scheduledAt: deletionDate,
      daysRemaining: 30,
    };
  }
}
