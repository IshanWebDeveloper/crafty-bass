import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import type { CreateJobDto, JobQueryDto } from './dto/index.js';

const JOB_LIST_INCLUDE = {
  category: { select: { id: true, slug: true, nameEn: true } },
  homeowner: { select: { id: true, name: true } },
  _count: { select: { quotes: true } },
} as const;

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateJobDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true },
    });
    if (user?.userType === 'TRADESMAN') {
      throw new ForbiddenException('Tradesmen cannot post jobs');
    }
    if (user && user.userType === null) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { userType: 'HOMEOWNER' },
      });
    }

    return this.prisma.job.create({
      data: {
        homeownerId: userId,
        title: dto.title,
        description: dto.description,
        descriptionLanguage: dto.descriptionLanguage,
        categoryId: dto.categoryId ?? null,
        urgency: dto.urgency,
        locationText: dto.locationText ?? null,
        city: dto.city ?? null,
        district: dto.district ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        budgetMin: dto.budgetMin ?? null,
        budgetMax: dto.budgetMax ?? null,
        scheduledFor: dto.scheduledFor ?? null,
        ...(dto.skillIds && dto.skillIds.length > 0
          ? {
              skills: {
                create: dto.skillIds.map((skillId) => ({
                  skillId,
                  source: 'manual',
                })),
              },
            }
          : {}),
      },
      include: JOB_LIST_INCLUDE,
    });
  }

  async browse(query: JobQueryDto) {
    const { page, limit, categoryId, district, city, urgency, status } = query;
    const skip = (page - 1) * limit;
    const where = {
      status: status ?? 'OPEN',
      ...(categoryId ? { categoryId } : {}),
      ...(district ? { district } : {}),
      ...(city ? { city } : {}),
      ...(urgency ? { urgency } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: JOB_LIST_INCLUDE,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findMine(userId: string, query: JobQueryDto) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;
    const where = {
      homeownerId: userId,
      ...(status ? { status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: JOB_LIST_INCLUDE,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, slug: true, nameEn: true } },
        homeowner: { select: { id: true, name: true } },
        skills: { include: { skill: true } },
        _count: { select: { quotes: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async cancel(userId: string, id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: { id: true, homeownerId: true, status: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.homeownerId !== userId) {
      throw new ForbiddenException('Not your job');
    }
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw new ForbiddenException(
        `Cannot cancel a ${job.status.toLowerCase()} job`,
      );
    }
    return this.prisma.job.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }
}
