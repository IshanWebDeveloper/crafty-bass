import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { UpdateProfileDto, UserListQueryDto } from './dto/index.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('gdpr-export') private readonly gdprExportQueue: Queue,
    private readonly recommendationsService: RecommendationsService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
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
        ...(dto.shippingAddress !== undefined && {
          shippingAddress: dto.shippingAddress,
        }),
        ...(dto.paymentPreferences !== undefined && {
          paymentPreferences: dto.paymentPreferences,
        }),
      },
    });
  }

  async getDashboard(userId: string) {
    const [
      recentOrders,
      wishlistData,
      totalOrders,
      pendingOrders,
      totalSpent,
      recommendations,
      activePromotions,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: {
            include: {
              variant: {
                include: { product: { select: { name: true, slug: true } } },
              },
            },
          },
        },
      }),
      this.prisma.wishlist.findUnique({
        where: { userId },
        include: {
          items: {
            take: 4,
            orderBy: { createdAt: 'desc' },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  basePrice: true,
                  brand: true,
                  images: { take: 1, orderBy: { position: 'asc' } },
                  variants: {
                    select: { stock: true },
                    take: 1,
                  },
                },
              },
            },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where: { userId } }),
      this.prisma.order.count({
        where: { userId, status: { in: ['PENDING', 'AWAITING_PAYMENT'] } },
      }),
      this.prisma.order.aggregate({
        where: { userId },
        _sum: { totalAmount: true },
      }),
      this.recommendationsService.getRecommendations(userId),
      this.promotionsService.getActivePromotions(),
    ]);

    return {
      recentOrders,
      wishlistItems: wishlistData?.items ?? [],
      wishlistCount: wishlistData?._count?.items ?? 0,
      totalOrders,
      pendingOrders,
      totalSpent: totalSpent._sum.totalAmount ?? 0,
      recommendations,
      activePromotions,
    };
  }

  async listUsers(query: UserListQueryDto) {
    const { page, limit, role, search } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role: role as Role }),
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
