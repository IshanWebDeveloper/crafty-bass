import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Role } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import type {
  CreateReportDto,
  UpdateReportDto,
  ReportQueryDto,
} from './dto/index.js';

const REPORT_INCLUDE = {
  reporter: { select: { id: true, name: true, image: true } },
  assignee: { select: { id: true, name: true, image: true } },
} as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateReportDto) {
    // Verify the target exists and capture denormalised foreign keys so
    // moderators can jump to the related Job/Message/Review without an
    // extra lookup.
    let jobId: string | null = null;
    let messageId: string | null = null;
    let reviewId: string | null = null;
    // When a party complains about an in-progress job, we pause it (see below).
    let disputeJobId: string | null = null;

    switch (dto.targetType) {
      case 'USER': {
        const user = await this.prisma.user.findUnique({
          where: { id: dto.targetId },
          select: { id: true },
        });
        if (!user) throw new NotFoundException('Reported user not found');
        if (user.id === userId) {
          throw new BadRequestException('You cannot report yourself');
        }
        break;
      }
      case 'JOB': {
        const job = await this.prisma.job.findUnique({
          where: { id: dto.targetId },
          select: {
            id: true,
            homeownerId: true,
            assignedTradesmanId: true,
            status: true,
          },
        });
        if (!job) throw new NotFoundException('Reported job not found');
        jobId = job.id;
        // A complaint from either party against an in-progress job pauses it:
        // the materials deposit is already with the tradesman, so instead of a
        // unilateral cancel the job moves to DISPUTED and support mediates any
        // refund. Restricted to the parties so unrelated users can't freeze a job.
        const isParty =
          job.homeownerId === userId || job.assignedTradesmanId === userId;
        if (job.status === 'IN_PROGRESS' && isParty) {
          disputeJobId = job.id;
        }
        break;
      }
      case 'QUOTE': {
        const quote = await this.prisma.quote.findUnique({
          where: { id: dto.targetId },
          select: { id: true, jobId: true },
        });
        if (!quote) throw new NotFoundException('Reported quote not found');
        jobId = quote.jobId;
        break;
      }
      case 'REVIEW': {
        const review = await this.prisma.review.findUnique({
          where: { id: dto.targetId },
          select: { id: true, jobId: true },
        });
        if (!review) throw new NotFoundException('Reported review not found');
        reviewId = review.id;
        jobId = review.jobId;
        break;
      }
      case 'MESSAGE': {
        const message = await this.prisma.message.findUnique({
          where: { id: dto.targetId },
          select: { id: true, conversationId: true, conversation: true },
        });
        if (!message) throw new NotFoundException('Reported message not found');
        messageId = message.id;
        jobId = message.conversation.jobId;
        break;
      }
    }

    // Block duplicate reports from the same user on the same target while
    // still under review.
    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'You have already reported this; the existing report is still being reviewed',
      );
    }

    const createReport = this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        jobId,
        messageId,
        reviewId,
      },
      include: REPORT_INCLUDE,
    });

    if (!disputeJobId) {
      return createReport;
    }

    // Pause the disputed job alongside filing the report. Guard on IN_PROGRESS in
    // the update so a concurrent transition (e.g. the tradesman marking work done)
    // can't be clobbered - updateMany is a no-op if the status already moved.
    const [report] = await this.prisma.$transaction([
      createReport,
      this.prisma.job.updateMany({
        where: { id: disputeJobId, status: 'IN_PROGRESS' },
        data: { status: 'DISPUTED' },
      }),
    ]);
    return report;
  }

  async listMine(userId: string, query: ReportQueryDto) {
    const { page, limit, status, targetType } = query;
    const skip = (page - 1) * limit;
    const where = {
      reporterId: userId,
      ...(status ? { status } : {}),
      ...(targetType ? { targetType } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: REPORT_INCLUDE,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async listAll(query: ReportQueryDto) {
    const { page, limit, status, targetType, assigneeId } = query;
    const skip = (page - 1) * limit;
    const where = {
      ...(status ? { status } : {}),
      ...(targetType ? { targetType } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: REPORT_INCLUDE,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(userId: string, role: Role, id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: REPORT_INCLUDE,
    });
    if (!report) throw new NotFoundException('Report not found');

    const isModerator = role === 'SUPPORT' || role === 'ADMIN';
    if (!isModerator && report.reporterId !== userId) {
      throw new ForbiddenException('You can only view reports you have filed');
    }
    return report;
  }

  async update(id: string, dto: UpdateReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { id: true, status: true, resolvedAt: true },
    });
    if (!report) throw new NotFoundException('Report not found');

    const reachedTerminal =
      dto.status === 'RESOLVED' || dto.status === 'DISMISSED';
    const wasTerminal =
      report.status === 'RESOLVED' || report.status === 'DISMISSED';

    return this.prisma.report.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.resolutionNotes !== undefined
          ? { resolutionNotes: dto.resolutionNotes }
          : {}),
        ...(reachedTerminal && !wasTerminal ? { resolvedAt: new Date() } : {}),
        ...(dto.status !== undefined && !reachedTerminal
          ? { resolvedAt: null }
          : {}),
      },
      include: REPORT_INCLUDE,
    });
  }
}
