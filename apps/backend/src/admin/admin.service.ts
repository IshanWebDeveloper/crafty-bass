import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  Prisma,
  type PromotionRuleType,
  type PromotionType,
  type Role,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import type { DateRangeQueryDto, AuditLogQueryDto } from './dto/index.js';
import { PdfService } from './pdf.service.js';
import { auth } from '../auth.js';
import { AuthService } from '@thallesp/nestjs-better-auth';

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

type PromotionRuleInput = {
  ruleType: PromotionRuleType;
  decimalValue?: number;
  intValue?: number;
  stringValue?: string;
  isActive?: boolean;
};

type CreatePromotionInput = {
  title: string;
  description?: string;
  type: PromotionType;
  value: number;
  code?: string;
  minAmount?: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  rules: PromotionRuleInput[];
  flashProductIds: string[];
};

type UpdatePromotionInput = {
  title?: string;
  description?: string;
  type?: PromotionType;
  value?: number;
  code?: string;
  minAmount?: number;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
  rules?: PromotionRuleInput[];
  flashProductIds?: string[];
};

type AdminPromotionListQuery = {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  type?: PromotionType;
};

@Injectable()
export class AdminService {
  private static readonly VALID_ROLES: Role[] = [
    'CUSTOMER',
    'ADMIN',
    'SUPPORT',
  ];
  private static readonly CURRENCY_CODE = 'GBP';

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private authService: AuthService<typeof auth>,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  private toJsonValue(
    value: unknown,
  ): string | number | boolean | null | Record<string, unknown> | unknown[] {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.toJsonValue(item));
    }

    if (typeof value === 'object') {
      const jsonObject: Record<string, unknown> = {};

      for (const [key, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (nestedValue !== undefined) {
          jsonObject[key] = this.toJsonValue(nestedValue);
        }
      }

      return jsonObject;
    }

    if (typeof value === 'symbol') {
      return value.toString();
    }

    if (typeof value === 'function') {
      return null;
    }

    return null;
  }

  private normalizePromotionCode(code?: string) {
    if (!code) {
      return undefined;
    }

    const normalized = code.trim().toUpperCase();
    return normalized.length > 0 ? normalized : undefined;
  }

  private buildPromotionRuleCreateInput(
    rules: PromotionRuleInput[],
  ): Prisma.PromotionRuleCreateWithoutPromotionInput[] {
    return rules.map((rule) => ({
      ruleType: rule.ruleType,
      decimalValue: rule.decimalValue,
      intValue: rule.intValue,
      stringValue: rule.stringValue,
      isActive: rule.isActive ?? true,
    }));
  }

  private async ensureProductsExist(productIds: string[]) {
    if (productIds.length === 0) {
      return;
    }

    const uniqueProductIds = [...new Set(productIds)];
    const existingCount = await this.prisma.product.count({
      where: {
        id: {
          in: uniqueProductIds,
        },
      },
    });

    if (existingCount !== uniqueProductIds.length) {
      throw new BadRequestException(
        'One or more flash-sale products were not found',
      );
    }
  }

  async getDashboard() {
    const [
      totalUsers,
      totalOrders,
      totalRevenue,
      pendingOrders,
      lowStockVariants,
      openTickets,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.order.count({
        where: { status: { in: ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED'] } },
      }),
      this.prisma.productVariant.findMany({
        select: { stock: true, lowStockThreshold: true },
      }),
      this.prisma.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
    ]);

    return {
      currencyCode: AdminService.CURRENCY_CODE,
      totalUsers,
      totalOrders,
      totalRevenue: Number(totalRevenue._sum.amount ?? 0),
      pendingOrders,
      lowStockAlerts: lowStockVariants.filter(
        (variant) => variant.stock <= variant.lowStockThreshold,
      ).length,
      openTickets,
    };
  }

  async getSalesReport(query: DateRangeQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

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

    return {
      currencyCode: AdminService.CURRENCY_CODE,
      totalOrders: orders.length,
      revenueByStatus: revenueByStatus.map((r) => ({
        status: r.status,
        count: r._count,
        revenue: Number(r._sum.totalAmount ?? 0),
      })),
      orders: orders.slice(0, 50),
    };
  }

  async downloadSalesReport(userId: string, query: DateRangeQueryDto) {
    const job = await this.reportsQueue.add('sales-report', {
      userId,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    return {
      jobId: job.id,
      message:
        'Report generation has started. You will receive a notification when it is ready.',
    };
  }

  async getProductReport() {
    const [topSelling, mostReviewed, lowStockCandidates] = await Promise.all([
      this.prisma.orderItem.groupBy({
        by: ['variantId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      this.prisma.review.groupBy({
        by: ['productId'],
        _count: true,
        _avg: { rating: true },
        orderBy: { _count: { rating: 'desc' } },
        take: 10,
      }),
      this.prisma.productVariant.findMany({
        include: { product: { select: { name: true, slug: true } } },
        orderBy: { stock: 'asc' },
      }),
    ]);

    return {
      topSelling,
      mostReviewed,
      lowStock: lowStockCandidates
        .filter((variant) => variant.stock <= variant.lowStockThreshold)
        .slice(0, 20),
    };
  }

  async getUserReport() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalUsers, usersByRole, newUsersLast30Days, users] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.groupBy({ by: ['role'], _count: true }),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: thirtyDaysAgo,
            },
          },
        }),
        this.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            banned: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      totalUsers,
      usersByRole: usersByRole.map((u) => ({ role: u.role, count: u._count })),
      newUsersLast30Days,
      users: users.map((user) => ({
        ...user,
        banned: Boolean(user.banned),
      })),
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      banned: Boolean(user.banned),
    };
  }

  async listPromotions(query: AdminPromotionListQuery) {
    const { page, limit, search, isActive, type } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PromotionWhereInput = {
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(type !== undefined ? { type } : {}),
    };

    const [promotions, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rules: {
            orderBy: { createdAt: 'asc' },
          },
          flashProducts: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          _count: {
            select: { orders: true },
          },
        },
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return {
      data: promotions,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findPromotionById(promotionId: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
      include: {
        rules: { orderBy: { createdAt: 'asc' } },
        flashProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    return { promotion };
  }

  async createPromotion(adminId: string, dto: CreatePromotionInput) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'Promotion end date must be after start date',
      );
    }

    const normalizedCode = this.normalizePromotionCode(dto.code);
    const normalizedFlashProductIds = [...new Set(dto.flashProductIds)];

    if (dto.type === 'FLASH_SALE' && normalizedFlashProductIds.length === 0) {
      throw new BadRequestException(
        'Flash sale promotions must include at least one product',
      );
    }

    await this.ensureProductsExist(normalizedFlashProductIds);

    if (normalizedCode) {
      const duplicate = await this.prisma.promotion.findFirst({
        where: { code: { equals: normalizedCode, mode: 'insensitive' } },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('Promotion code already exists');
      }
    }

    const promotion = await this.prisma.promotion.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        value: dto.value,
        code: normalizedCode,
        minAmount: dto.minAmount,
        startsAt,
        endsAt,
        isActive: dto.isActive,
        rules:
          dto.rules.length > 0
            ? { create: this.buildPromotionRuleCreateInput(dto.rules) }
            : undefined,
        flashProducts:
          normalizedFlashProductIds.length > 0
            ? {
                createMany: {
                  data: normalizedFlashProductIds.map((productId) => ({
                    productId,
                  })),
                },
              }
            : undefined,
      },
      include: {
        rules: { orderBy: { createdAt: 'asc' } },
        flashProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: { select: { orders: true } },
      },
    });

    await this.log(adminId, 'PROMOTION_CREATE', 'promotion', promotion.id, {
      title: promotion.title,
      code: promotion.code,
      type: promotion.type,
      rulesCount: dto.rules.length,
      flashProductCount: normalizedFlashProductIds.length,
    });

    return { promotion };
  }

  async updatePromotion(
    adminId: string,
    promotionId: string,
    dto: UpdatePromotionInput,
  ) {
    const existingRuleCount = await this.prisma.promotionRule.count({
      where: { promotionId },
    });

    const existing = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
    });

    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    const existingFlashProducts = await this.prisma.$queryRaw<
      Array<{ productId: string }>
    >`
      SELECT "productId"
      FROM "flash_sale_product"
      WHERE "promotionId" = ${promotionId}
    `;

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;

    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'Promotion end date must be after start date',
      );
    }

    const normalizedCode =
      dto.code === undefined
        ? undefined
        : this.normalizePromotionCode(dto.code);

    if (normalizedCode) {
      const duplicate = await this.prisma.promotion.findFirst({
        where: {
          id: { not: promotionId },
          code: { equals: normalizedCode, mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('Promotion code already exists');
      }
    }

    const effectiveType = dto.type ?? existing.type;
    const existingFlashProductIds = existingFlashProducts.map(
      (item) => item.productId,
    );

    const normalizedFlashProductIds: string[] =
      dto.flashProductIds !== undefined
        ? [...new Set(dto.flashProductIds)]
        : existingFlashProductIds;

    if (
      effectiveType === 'FLASH_SALE' &&
      normalizedFlashProductIds.length === 0
    ) {
      throw new BadRequestException(
        'Flash sale promotions must include at least one product',
      );
    }

    await this.ensureProductsExist(normalizedFlashProductIds);

    const promotionUpdateData: Prisma.PromotionUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.value !== undefined ? { value: dto.value } : {}),
      ...(dto.code !== undefined ? { code: normalizedCode } : {}),
      ...(dto.minAmount !== undefined ? { minAmount: dto.minAmount } : {}),
      ...(dto.startsAt !== undefined ? { startsAt } : {}),
      ...(dto.endsAt !== undefined ? { endsAt } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.rules !== undefined
        ? {
            rules: {
              deleteMany: {},
              ...(dto.rules.length > 0
                ? {
                    create: this.buildPromotionRuleCreateInput(dto.rules),
                  }
                : {}),
            },
          }
        : {}),
      ...(dto.flashProductIds !== undefined
        ? {
            flashProducts: {
              deleteMany: {},
              ...(normalizedFlashProductIds.length > 0
                ? {
                    createMany: {
                      data: normalizedFlashProductIds.map((productId) => ({
                        productId,
                      })),
                    },
                  }
                : {}),
            },
          }
        : {}),
    };

    const promotion = await this.prisma.promotion.update({
      where: { id: promotionId },
      data: promotionUpdateData,
      include: {
        rules: { orderBy: { createdAt: 'asc' } },
        flashProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: { select: { orders: true } },
      },
    });

    const nextRuleCount =
      dto.rules !== undefined ? dto.rules.length : existingRuleCount;

    await this.log(adminId, 'PROMOTION_UPDATE', 'promotion', promotion.id, {
      before: {
        title: existing.title,
        code: existing.code,
        type: existing.type,
        isActive: existing.isActive,
        rulesCount: existingRuleCount,
        flashProductCount: existingFlashProductIds.length,
      },
      after: {
        title: promotion.title,
        code: promotion.code,
        type: promotion.type,
        isActive: promotion.isActive,
        rulesCount: nextRuleCount,
        flashProductCount: normalizedFlashProductIds.length,
      },
    });

    return { promotion };
  }

  async deactivatePromotion(adminId: string, promotionId: string) {
    const existing = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
      select: { id: true, isActive: true, code: true },
    });

    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    const promotion = await this.prisma.promotion.update({
      where: { id: promotionId },
      data: { isActive: false },
      include: {
        rules: { orderBy: { createdAt: 'asc' } },
        flashProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: { select: { orders: true } },
      },
    });

    await this.log(adminId, 'PROMOTION_DEACTIVATE', 'promotion', promotion.id, {
      wasActive: existing.isActive,
      code: existing.code,
    });

    return { promotion };
  }

  async createUser(
    adminId: string,
    dto: CreateUserInput,
    headers: HeadersInit,
  ) {
    if (!AdminService.VALID_ROLES.includes(dto.role)) {
      throw new BadRequestException('Invalid role');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const data = await this.authService.api.createUser({
      body: {
        name: dto.name,
        email: dto.email,
        password: dto.password,
        role: dto.role,
      },
      headers,
    });

    await this.log(adminId, 'CREATE_USER', 'User', data.user.id, {
      email: data.user.email,
      role: data.user.role,
    });

    return data.user;
  }

  async updateUserRole(
    adminId: string,
    targetUserId: string,
    newRole: Role,
    headers: HeadersInit,
  ) {
    if (adminId === targetUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    if (!AdminService.VALID_ROLES.includes(newRole)) {
      throw new BadRequestException('Invalid role');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const data = await this.authService.api.setRole({
      body: {
        userId: targetUserId,
        role: newRole,
      },
      headers,
    });

    await this.log(adminId, 'UPDATE_ROLE', 'User', targetUserId, {
      previousRole: existingUser.role,
      newRole,
    });

    return data.user;
  }

  async banUser(
    adminId: string,
    targetUserId: string,
    reason: string | undefined,
    headers: HeadersInit,
  ) {
    if (adminId === targetUserId) {
      throw new ForbiddenException('Cannot ban yourself');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { banned: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (existingUser.banned) {
      throw new BadRequestException('User is already banned');
    }

    await this.authService.api.banUser({
      body: { userId: targetUserId, banReason: reason },
      headers,
    });

    await this.log(adminId, 'BAN_USER', 'User', targetUserId, { reason });

    return { message: 'User has been banned' };
  }

  async unbanUser(
    adminId: string,
    targetUserId: string,
    headers: HeadersInit,
  ): Promise<{ message: string }> {
    if (adminId === targetUserId) {
      throw new ForbiddenException('Cannot unban yourself');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { banned: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (!existingUser.banned) {
      throw new BadRequestException('User is not banned');
    }

    await this.authService.api.unbanUser({
      body: { userId: targetUserId },
      headers,
    });

    await this.log(adminId, 'UNBAN_USER', 'User', targetUserId);

    return { message: 'User has been unbanned' };
  }

  async getAuditLogs(query: AuditLogQueryDto) {
    const { page, limit, entity, userId, entityId } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;
    if (entityId) where.entityId = entityId;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: logs, meta: buildPaginationMeta(total, page, limit) };
  }

  // Called by other services to log mutations
  async log(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    details?: unknown,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details:
          details === undefined
            ? undefined
            : (() => {
                const normalizedDetails = this.toJsonValue(details);
                return normalizedDetails === null
                  ? Prisma.JsonNull
                  : (normalizedDetails as Prisma.InputJsonValue);
              })(),
      },
    });
  }
}
