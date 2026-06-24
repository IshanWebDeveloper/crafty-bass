import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { FundEscrowDto } from './dto/index.js';

// Loaded once per request so the service can both authorise the caller and run
// the state machine without a second round-trip.
const ESCROW_INCLUDE = {
  job: { select: { id: true, title: true, status: true } },
  homeowner: { select: { id: true, name: true, image: true } },
  tradesman: { select: { id: true, name: true, image: true } },
  transactions: { orderBy: { createdAt: 'asc' } },
} as const;

type EscrowWithRelations = Prisma.JobEscrowGetPayload<{
  include: typeof ESCROW_INCLUDE;
}>;

const dec = (v: Prisma.Decimal | number) => Number(v);

@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(e: EscrowWithRelations) {
    return {
      id: e.id,
      jobId: e.jobId,
      quoteId: e.quoteId,
      status: e.status,
      currency: e.currency,
      quoteTotal: dec(e.quoteTotal),
      materialsAmount: dec(e.materialsAmount),
      depositAmount: dec(e.depositAmount),
      balanceAmount: dec(e.balanceAmount),
      paymentMethod: e.paymentMethod,
      fundedAt: e.fundedAt,
      materialsReleasedAt: e.materialsReleasedAt,
      workCompletedAt: e.workCompletedAt,
      releasedAt: e.releasedAt,
      refundedAt: e.refundedAt,
      createdAt: e.createdAt,
      job: e.job,
      homeowner: e.homeowner,
      tradesman: e.tradesman,
      transactions: e.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: dec(t.amount),
        note: t.note,
        createdAt: t.createdAt,
      })),
    };
  }

  private async loadParty(escrowId: string, userId: string) {
    const escrow = await this.prisma.jobEscrow.findUnique({
      where: { id: escrowId },
      include: ESCROW_INCLUDE,
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    const isParty =
      escrow.homeownerId === userId || escrow.tradesmanId === userId;
    if (!isParty) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user?.role !== 'SUPPORT' && user?.role !== 'ADMIN') {
        throw new ForbiddenException('Not a party to this escrow');
      }
    }
    return escrow;
  }

  async getById(userId: string, escrowId: string) {
    return this.serialize(await this.loadParty(escrowId, userId));
  }

  async getForJob(userId: string, jobId: string) {
    const escrow = await this.prisma.jobEscrow.findUnique({
      where: { jobId },
      include: ESCROW_INCLUDE,
    });
    if (!escrow) throw new NotFoundException('No escrow for this job');
    return this.serialize(await this.loadParty(escrow.id, userId));
  }

  // Homeowner pays the deposit to Crafty Bass; it is now held in escrow.
  // Payment capture is stubbed (real Stripe / PayHere is Phase C) — we record
  // the chosen method and a simulated reference.
  async fund(userId: string, escrowId: string, dto: FundEscrowDto) {
    const escrow = await this.loadParty(escrowId, userId);
    if (escrow.homeownerId !== userId) {
      throw new ForbiddenException('Only the homeowner can fund the deposit');
    }
    if (escrow.status !== 'REQUESTED') {
      throw new ConflictException('Deposit is not awaiting funding');
    }
    const updated = await this.prisma.jobEscrow.update({
      where: { id: escrowId },
      data: {
        status: 'FUNDED',
        paymentMethod: dto.paymentMethod,
        paymentRef: `sim_${dto.paymentMethod}_${Date.now()}`,
        fundedAt: new Date(),
        transactions: {
          create: {
            type: 'FUND',
            amount: escrow.depositAmount,
            note: `Deposit funded via ${dto.paymentMethod}`,
          },
        },
      },
      include: ESCROW_INCLUDE,
    });
    return this.serialize(updated);
  }

  // Tradesman confirms they are starting; Crafty Bass releases the held deposit
  // so they can buy parts, and the job moves to IN_PROGRESS.
  async releaseMaterials(userId: string, escrowId: string) {
    const escrow = await this.loadParty(escrowId, userId);
    if (escrow.tradesmanId !== userId) {
      throw new ForbiddenException('Only the tradesman can start the work');
    }
    if (escrow.status !== 'FUNDED') {
      throw new ConflictException('Deposit has not been funded yet');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: escrow.jobId },
        data: { status: 'IN_PROGRESS' },
      });
      return tx.jobEscrow.update({
        where: { id: escrowId },
        data: {
          status: 'MATERIALS_RELEASED',
          materialsReleasedAt: new Date(),
          transactions: {
            create: {
              type: 'RELEASE_MATERIALS',
              amount: escrow.depositAmount,
              note: 'Materials deposit released to tradesman',
            },
          },
        },
        include: ESCROW_INCLUDE,
      });
    });
    return this.serialize(updated);
  }

  // Tradesman marks the job finished and awaits the homeowner's approval.
  async markWorkDone(userId: string, escrowId: string) {
    const escrow = await this.loadParty(escrowId, userId);
    if (escrow.tradesmanId !== userId) {
      throw new ForbiddenException('Only the tradesman can mark work done');
    }
    if (escrow.status !== 'MATERIALS_RELEASED') {
      throw new ConflictException('Work is not in progress');
    }
    const updated = await this.prisma.jobEscrow.update({
      where: { id: escrowId },
      data: { status: 'WORK_COMPLETED', workCompletedAt: new Date() },
      include: ESCROW_INCLUDE,
    });
    return this.serialize(updated);
  }

  // Homeowner approves the finished work; the balance is paid out and the job
  // is completed.
  async approve(userId: string, escrowId: string) {
    const escrow = await this.loadParty(escrowId, userId);
    if (escrow.homeownerId !== userId) {
      throw new ForbiddenException('Only the homeowner can approve the work');
    }
    if (escrow.status !== 'WORK_COMPLETED') {
      throw new ConflictException('Work has not been marked complete');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: escrow.jobId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return tx.jobEscrow.update({
        where: { id: escrowId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          transactions: {
            create: {
              type: 'RELEASE_BALANCE',
              amount: escrow.balanceAmount,
              note: 'Balance released on approval',
            },
          },
        },
        include: ESCROW_INCLUDE,
      });
    });
    return this.serialize(updated);
  }

  // Refundable until work begins: a funded-but-not-started deposit can be
  // returned to the homeowner (by them, or by support during mediation).
  async refund(userId: string, escrowId: string) {
    const escrow = await this.loadParty(escrowId, userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isSupport = user?.role === 'SUPPORT' || user?.role === 'ADMIN';
    if (escrow.homeownerId !== userId && !isSupport) {
      throw new ForbiddenException(
        'Only the homeowner or support can refund a deposit',
      );
    }
    if (escrow.status !== 'FUNDED') {
      throw new ConflictException(
        'Only a funded deposit that has not been released can be refunded',
      );
    }
    const updated = await this.prisma.jobEscrow.update({
      where: { id: escrowId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        transactions: {
          create: {
            type: 'REFUND',
            amount: escrow.depositAmount,
            note: 'Deposit refunded to homeowner',
          },
        },
      },
      include: ESCROW_INCLUDE,
    });
    return this.serialize(updated);
  }
}
