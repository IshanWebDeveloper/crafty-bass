import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { CreateQuoteDto } from './dto/index.js';

const QUOTE_INCLUDE = {
  tradesman: {
    select: {
      id: true,
      name: true,
      image: true,
      tradesmanProfile: {
        select: { avgRating: true, ratingCount: true, jobsCompleted: true },
      },
    },
  },
} as const;

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, jobId: string, dto: CreateQuoteDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, homeownerId: true, status: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.homeownerId === userId) {
      throw new ForbiddenException('You cannot quote on your own job');
    }
    if (job.status !== 'OPEN') {
      throw new ConflictException('Job is no longer open for quotes');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true },
    });
    if (user?.userType === 'HOMEOWNER') {
      throw new ForbiddenException('Homeowners cannot submit quotes');
    }
    if (user && user.userType === null) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { userType: 'TRADESMAN' },
      });
    }

    const existing = await this.prisma.quote.findUnique({
      where: { jobId_tradesmanId: { jobId, tradesmanId: userId } },
    });
    if (existing) {
      throw new ConflictException('You have already quoted on this job');
    }

    return this.prisma.quote.create({
      data: {
        jobId,
        tradesmanId: userId,
        amount: dto.amount,
        currency: dto.currency,
        message: dto.message ?? null,
        estimatedStart: dto.estimatedStart ?? null,
        estimatedCompletion: dto.estimatedCompletion ?? null,
      },
    });
  }

  async listForJob(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { homeownerId: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.homeownerId !== userId) {
      throw new ForbiddenException('Only the job owner can view quotes');
    }
    return this.prisma.quote.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
      include: QUOTE_INCLUDE,
    });
  }

  async accept(userId: string, quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        job: { select: { id: true, homeownerId: true, status: true } },
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.job.homeownerId !== userId) {
      throw new ForbiddenException('Only the job owner can accept a quote');
    }
    if (quote.job.status !== 'OPEN') {
      throw new ConflictException('Job is no longer open');
    }
    if (quote.status !== 'PENDING') {
      throw new ConflictException('Quote is not pending');
    }

    return this.prisma.$transaction(async (tx) => {
      const accepted = await tx.quote.update({
        where: { id: quoteId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      await tx.quote.updateMany({
        where: { jobId: quote.jobId, id: { not: quoteId }, status: 'PENDING' },
        data: { status: 'REJECTED', respondedAt: new Date() },
      });
      await tx.job.update({
        where: { id: quote.jobId },
        data: {
          status: 'ASSIGNED',
          assignedTradesmanId: quote.tradesmanId,
          acceptedQuoteId: quoteId,
        },
      });
      return accepted;
    });
  }

  async reject(userId: string, quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { job: { select: { homeownerId: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.job.homeownerId !== userId) {
      throw new ForbiddenException('Only the job owner can reject a quote');
    }
    if (quote.status !== 'PENDING') {
      throw new ConflictException('Quote is not pending');
    }
    return this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'REJECTED', respondedAt: new Date() },
    });
  }

  async withdraw(userId: string, quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { id: true, tradesmanId: true, status: true },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.tradesmanId !== userId) {
      throw new ForbiddenException('Not your quote');
    }
    if (quote.status !== 'PENDING') {
      throw new ConflictException('Only pending quotes can be withdrawn');
    }
    return this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    });
  }
}
