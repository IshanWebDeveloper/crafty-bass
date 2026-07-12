import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import type { CreateJobDto, JobQueryDto, UpdateJobDto } from './dto/index.js';

const JOB_LIST_INCLUDE = {
  category: { select: { id: true, slug: true, nameEn: true } },
  homeowner: { select: { id: true, name: true } },
  _count: { select: { quotes: true } },
} as const;

// How long an OPEN job stays live before expiring, by urgency. More urgent jobs
// lapse sooner so the board reflects work that's still actionable.
const EXPIRY_DAYS_BY_URGENCY: Record<string, number> = {
  EMERGENCY: 1,
  HIGH: 3,
  MEDIUM: 7,
  LOW: 14,
};

function expiryFromUrgency(urgency: string, from = new Date()): Date {
  const days = EXPIRY_DAYS_BY_URGENCY[urgency] ?? 7;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
        taskSize: dto.taskSize ?? null,
        vehicleRequirement: dto.vehicleRequirement ?? null,
        expiresAt: expiryFromUrgency(dto.urgency),
        locationText: dto.locationText ?? null,
        city: dto.city ?? null,
        district: dto.district ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        budgetMin: dto.budgetMin ?? null,
        budgetMax: dto.budgetMax ?? null,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
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

  // Admin/support monitoring: unlike `browse` (which defaults to OPEN only),
  // this lists every job and only narrows by status when one is supplied.
  async listAllForAdmin(query: JobQueryDto) {
    const { page, limit, categoryId, district, city, urgency, status } = query;
    const skip = (page - 1) * limit;
    const where = {
      ...(status ? { status } : {}),
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
        include: {
          ...JOB_LIST_INCLUDE,
          assignedTradesman: { select: { id: true, name: true } },
        },
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

  // Admin/support detail: richer than the public findOne - includes the
  // assigned tradesman, quotes (with quoter), escrow ledger status, and any
  // reports filed against the job. Kept out of the public findOne so this data
  // is never exposed on the public job page.
  async findOneForAdmin(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, slug: true, nameEn: true } },
        homeowner: { select: { id: true, name: true, email: true } },
        assignedTradesman: { select: { id: true, name: true, email: true } },
        skills: { include: { skill: true } },
        quotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            tradesman: { select: { id: true, name: true } },
          },
        },
        escrow: { select: { id: true, status: true, quoteTotal: true } },
        reports: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            reason: true,
            targetType: true,
            createdAt: true,
          },
        },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  // Public marketplace tallies for the landing page - real counts instead of
  // hardcoded marketing numbers. "matched" = jobs that reached a tradesman
  // (someone was assigned), which is the outcome the homepage advertises.
  async publicStats() {
    const [openJobs, matchedJobs, verifiedTradespeople] = await Promise.all([
      this.prisma.job.count({ where: { status: 'OPEN' } }),
      this.prisma.job.count({ where: { assignedTradesmanId: { not: null } } }),
      this.prisma.tradesmanProfile.count({ where: { isVerified: true } }),
    ]);
    return { openJobs, matchedJobs, verifiedTradespeople };
  }

  async update(userId: string, id: string, dto: UpdateJobDto) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: { id: true, homeownerId: true, status: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.homeownerId !== userId) {
      throw new ForbiddenException('Not your job');
    }
    // Only an open job (no tradesman assigned yet) can be edited - once a quote
    // is accepted the agreed scope must not move under the tradesman's feet.
    if (job.status !== 'OPEN') {
      throw new ForbiddenException(
        `Cannot edit a job that is ${job.status.toLowerCase()}`,
      );
    }

    return this.prisma.job.update({
      where: { id },
      // Prisma skips `undefined` fields, so a partial DTO patches only what the
      // homeowner changed. Changing urgency also resets the expiry countdown
      // from now, mirroring how `create` derives expiresAt from urgency.
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.urgency !== undefined
          ? { urgency: dto.urgency, expiresAt: expiryFromUrgency(dto.urgency) }
          : {}),
        ...(dto.taskSize !== undefined ? { taskSize: dto.taskSize } : {}),
        ...(dto.vehicleRequirement !== undefined
          ? { vehicleRequirement: dto.vehicleRequirement }
          : {}),
        ...(dto.locationText !== undefined
          ? { locationText: dto.locationText }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.district !== undefined ? { district: dto.district } : {}),
        ...(dto.budgetMin !== undefined ? { budgetMin: dto.budgetMin } : {}),
        ...(dto.budgetMax !== undefined ? { budgetMax: dto.budgetMax } : {}),
        ...(dto.scheduledFor !== undefined
          ? {
              scheduledFor: dto.scheduledFor
                ? new Date(dto.scheduledFor)
                : null,
            }
          : {}),
      },
      include: JOB_LIST_INCLUDE,
    });
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
    // Once work is underway the materials deposit has already been released to
    // the tradesman (escrow → MATERIALS_RELEASED flips the job to IN_PROGRESS),
    // so the homeowner can't unilaterally cancel and claw the money back. They
    // file a report instead and support mediates any refund. See
    // EscrowService.releaseMaterials.
    if (job.status === 'IN_PROGRESS') {
      throw new ForbiddenException(
        'Work has already started and the materials deposit has been released, ' +
          'so this job can no longer be cancelled directly. Please file a report ' +
          'and our team will review it and arrange any refund.',
      );
    }
    if (job.status === 'DISPUTED') {
      throw new ForbiddenException(
        'This job is under review by our team following a report. ' +
          'They will decide on cancellation and any refund.',
      );
    }
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw new ForbiddenException(
        `Cannot cancel a ${job.status.toLowerCase()} job`,
      );
    }
    const cancelled = await this.prisma.job.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    // If a tradesman had been assigned, let them know it's off. Best-effort;
    // no-ops for a still-open job with nobody assigned.
    await this.notifications.notifyJobCancelled(id);
    return cancelled;
  }
}
