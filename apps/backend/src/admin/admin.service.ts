import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type Role, Prisma } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import { auth } from '@repo/auth';
import { AuthService } from '@thallesp/nestjs-better-auth';

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

/**
 * Marketplace-safe admin surface after the legacy sweep: user management
 * (create/ban/role) over better-auth, plus the GDPR-export support services
 * (PdfService / S3Service) kept available to the module.
 *
 * TODO(Phase C): rebuild the marketplace admin reporting/dashboard (jobs,
 * quotes, disputes) and a marketplace audit trail. The legacy e-commerce
 * dashboards, sales/product reports, promotions, and AuditLog persistence were
 * removed with their models.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private static readonly VALID_ROLES: Role[] = [
    'CUSTOMER',
    'ADMIN',
    'SUPPORT',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private authService: AuthService<typeof auth>,
  ) {}

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        role: true,
        userType: true,
        banned: true,
        banReason: true,
        createdAt: true,
        updatedAt: true,
        homeownerProfile: {
          select: { city: true, district: true, locationText: true },
        },
        tradesmanProfile: {
          select: {
            city: true,
            district: true,
            yearsExperience: true,
            isVerified: true,
            backgroundChecked: true,
            avgRating: true,
            ratingCount: true,
            jobsCompleted: true,
          },
        },
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

  /**
   * Aggregated platform metrics for the admin dashboard overview. Returns
   * headline counts (users, jobs, quotes, moderation queues, escrow) plus a
   * 30-day daily time series of new jobs and signups for the trend charts.
   * Available to ADMIN and SUPPORT (moderators need the moderation KPIs).
   */
  async getMetrics() {
    const DAYS = 30;
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - (DAYS - 1));
    since.setHours(0, 0, 0, 0);

    const [
      userTotal,
      usersByType,
      bannedCount,
      newUsers,
      jobTotal,
      jobsByStatus,
      quoteTotal,
      quotesByStatus,
      openReports,
      underReviewReports,
      pendingVerifications,
      hiddenReviews,
      escrowActive,
      recentJobs,
      recentSignups,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({ by: ['userType'], _count: { _all: true } }),
      this.prisma.user.count({ where: { banned: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.job.count(),
      this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.quote.count(),
      this.prisma.quote.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.report.count({ where: { status: 'UNDER_REVIEW' } }),
      this.prisma.tradesmanVerification.count({ where: { status: 'PENDING' } }),
      this.prisma.review.count({ where: { isPublic: false } }),
      this.prisma.jobEscrow.aggregate({
        where: {
          status: { in: ['FUNDED', 'MATERIALS_RELEASED', 'WORK_COMPLETED'] },
        },
        _count: { _all: true },
        _sum: { quoteTotal: true },
      }),
      this.prisma.job.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

    const typeCount = (type: 'HOMEOWNER' | 'TRADESMAN') =>
      usersByType.find((g) => g.userType === type)?._count._all ?? 0;
    const jobStatus = (status: string) =>
      jobsByStatus.find((g) => g.status === status)?._count._all ?? 0;
    const quoteStatus = (status: string) =>
      quotesByStatus.find((g) => g.status === status)?._count._all ?? 0;

    const jobsByDay = this.bucketByDay(recentJobs);
    const signupsByDay = this.bucketByDay(recentSignups);
    const series = Array.from({ length: DAYS }, (_, i) => {
      const day = new Date(since);
      day.setDate(since.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      return {
        date: key,
        jobs: jobsByDay.get(key) ?? 0,
        signups: signupsByDay.get(key) ?? 0,
      };
    });

    return {
      users: {
        total: userTotal,
        homeowners: typeCount('HOMEOWNER'),
        tradesmen: typeCount('TRADESMAN'),
        banned: bannedCount,
        newLast30Days: newUsers,
      },
      jobs: {
        total: jobTotal,
        open: jobStatus('OPEN'),
        assigned: jobStatus('ASSIGNED'),
        inProgress: jobStatus('IN_PROGRESS'),
        disputed: jobStatus('DISPUTED'),
        completed: jobStatus('COMPLETED'),
        cancelled: jobStatus('CANCELLED'),
        expired: jobStatus('EXPIRED'),
      },
      quotes: {
        total: quoteTotal,
        pending: quoteStatus('PENDING'),
        accepted: quoteStatus('ACCEPTED'),
      },
      moderation: {
        openReports,
        underReviewReports,
        pendingVerifications,
        hiddenReviews,
      },
      escrow: {
        activeCount: escrowActive._count._all,
        activeValue: Number(escrowActive._sum.quoteTotal ?? 0),
        currency: 'LKR',
      },
      series,
    };
  }

  /** Buckets createdAt timestamps into a YYYY-MM-DD → count map. */
  private bucketByDay(rows: { createdAt: Date }[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Persists an admin action to the AuditLog and mirrors it to the structured
   * logger. A failure to write the audit row must never break the underlying
   * admin action, so persistence errors are swallowed (and logged) rather than
   * propagated.
   */
  async log(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    details?: unknown,
  ): Promise<void> {
    this.logger.log({
      msg: '[admin.audit]',
      userId,
      action,
      entity,
      entityId,
      details,
    });
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action,
          entity,
          entityId,
          details:
            details === undefined
              ? undefined
              : (details as Prisma.InputJsonValue),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist audit log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Paginated audit trail for the admin console, newest first. */
  async listAuditLog(query: {
    page: number;
    limit: number;
    entity?: string;
    userId?: string;
    entityId?: string;
  }) {
    const { page, limit, entity, userId, entityId } = query;
    const skip = (page - 1) * limit;
    const where = {
      ...(entity && { entity }),
      ...(userId && { actorId: userId }),
      ...(entityId && { entityId }),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
}
