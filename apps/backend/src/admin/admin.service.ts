import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Role } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
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
   * No-op audit hook. The legacy AuditLog model was removed in the marketplace
   * migration. TODO(Phase C): persist admin actions to a marketplace audit trail.
   */
  async log(
    _userId: string,
    _action: string,
    _entity: string,
    _entityId: string,
    _details?: unknown,
  ): Promise<void> {
    return;
  }
}
