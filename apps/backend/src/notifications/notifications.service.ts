import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationType, Role } from '@repo/db';
import { Resend } from 'resend';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend?: Resend;
  private readonly emailFrom: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = resendApiKey ? new Resend(resendApiKey) : undefined;
    this.emailFrom =
      this.config.get<string>('RESEND_FROM_EMAIL') ??
      'StreetGadgets <onboarding@resend.dev>';
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
  ) {
    return this.prisma.notification.create({
      data: { userId, type, title, body },
    });
  }

  async createForUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
  ) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueUserIds.length === 0) {
      return { count: 0 };
    }

    return this.prisma.notification.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        type,
        title,
        body,
      })),
    });
  }

  async getUserIdsByRoles(roles: Role[]) {
    if (roles.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        role: {
          in: roles,
        },
      },
      select: {
        id: true,
      },
    });

    return users.map((user) => user.id);
  }

  async createForUser(
    targetUserId: string,
    type: NotificationType,
    title: string,
    body: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.notification.create({
      data: { userId: targetUserId, type, title, body },
    });
  }

  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });

    return {
      data: notifications,
      unreadCount,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  async createPriceDropAlert(input: {
    userId: string;
    productName: string;
    productSlug: string;
    previousPrice: number;
    currentPrice: number;
    dropPercent: number;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: 'PRICE_DROP',
        title: `Price dropped: ${input.productName}`,
        body: `${input.dropPercent.toFixed(1)}% drop from $${input.previousPrice.toFixed(2)} to $${input.currentPrice.toFixed(2)}.`,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });

    if (user?.email) {
      await this.sendPriceDropEmail({
        email: user.email,
        productName: input.productName,
        productSlug: input.productSlug,
        previousPrice: input.previousPrice,
        currentPrice: input.currentPrice,
        dropPercent: input.dropPercent,
      });
    }

    return notification;
  }

  private async sendPriceDropEmail(input: {
    email: string;
    productName: string;
    productSlug: string;
    previousPrice: number;
    currentPrice: number;
    dropPercent: number;
  }) {
    if (!this.resend) {
      return;
    }

    const productUrl = `${this.frontendUrl}/products/${input.productSlug}`;

    try {
      await this.resend.emails.send({
        to: input.email,
        from: this.emailFrom,
        subject: `Price drop alert: ${input.productName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
            <h2>${input.productName} is now cheaper</h2>
            <p>${input.dropPercent.toFixed(1)}% price drop detected on an item in your wishlist.</p>
            <p style="font-size: 15px;">
              Previous price: <strong>$${input.previousPrice.toFixed(2)}</strong><br/>
              New price: <strong>$${input.currentPrice.toFixed(2)}</strong>
            </p>
            <p style="margin: 24px 0;">
              <a href="${productUrl}" style="background-color: #111827; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                View Product
              </a>
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send price-drop email to ${input.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async listForAdmin(userId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = userId ? { userId } : {};

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: {
        ...where,
        readAt: null,
      },
    });

    return {
      data: notifications,
      unreadCount,
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
