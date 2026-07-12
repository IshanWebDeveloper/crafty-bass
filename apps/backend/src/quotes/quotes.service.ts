import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { maxDeposit, computeQuoteTotals, VAT_RATE } from '@repo/validation';
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
  materials: { orderBy: { createdAt: 'asc' } },
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
      select: {
        userType: true,
        tradesmanProfile: {
          select: {
            isVerified: true,
            avgRating: true,
            jobsCompleted: true,
            backgroundChecked: true,
          },
        },
      },
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

    // Build the total server-side from the line items + adjustments so we never
    // trust client-side maths (it drives escrow and what the homeowner pays).
    const totals = computeQuoteTotals(dto.lineItems, {
      calloutFee: dto.calloutFee,
      discount: dto.discount,
      applyVat: dto.applyVat,
    });

    // A requested materials deposit must sit within the tradesman's trust tier
    // and never exceed the materials line on the quote.
    const depositRequested = dto.depositRequested ?? 0;
    if (depositRequested > 0) {
      const profile = user?.tradesmanProfile;
      const allowed = maxDeposit(
        {
          verified: profile?.isVerified ?? false,
          rating: profile ? Number(profile.avgRating) : 0,
          completed: profile?.jobsCompleted ?? 0,
          bgChecked: profile?.backgroundChecked ?? false,
        },
        totals.total,
        totals.materials,
      );
      if (depositRequested > allowed) {
        throw new BadRequestException(
          `Requested deposit exceeds your allowed maximum of ${allowed}`,
        );
      }
    }

    const validUntil = new Date(
      Date.now() + dto.validityDays * 24 * 60 * 60 * 1000,
    );

    return this.prisma.quote.create({
      data: {
        jobId,
        tradesmanId: userId,
        amount: totals.total,
        materialsAmount: totals.materials,
        calloutFee: dto.calloutFee ?? null,
        discount: dto.discount ?? null,
        vatRate: dto.applyVat ? VAT_RATE : null,
        depositRequested: dto.depositRequested ?? null,
        currency: dto.currency,
        message: dto.message ?? null,
        estimatedStart: dto.estimatedStart ?? null,
        estimatedCompletion: dto.estimatedCompletion ?? null,
        validUntil,
        materials: {
          create: dto.lineItems.map((l) => ({
            category: l.category,
            name: l.name,
            quantity: l.quantity,
            unit: l.unit ?? null,
            unitPrice: l.unitPrice,
          })),
        },
      },
      include: QUOTE_INCLUDE,
    });
  }

  async listMine(userId: string) {
    return this.prisma.quote.findMany({
      where: { tradesmanId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            status: true,
            city: true,
            district: true,
          },
        },
        materials: { orderBy: { createdAt: 'asc' } },
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

    // Snapshot the deposit amounts now so later edits can't move money.
    const deposit = quote.depositRequested ? Number(quote.depositRequested) : 0;
    const total = Number(quote.amount);
    const materials = quote.materialsAmount ? Number(quote.materialsAmount) : 0;

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
      if (deposit > 0) {
        await tx.jobEscrow.create({
          data: {
            jobId: quote.jobId,
            quoteId,
            homeownerId: quote.job.homeownerId,
            tradesmanId: quote.tradesmanId,
            currency: quote.currency,
            quoteTotal: total,
            materialsAmount: materials,
            depositAmount: deposit,
            balanceAmount: total - deposit,
          },
        });
      }
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
