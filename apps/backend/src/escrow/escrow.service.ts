import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { StripeService } from '../common/services/stripe.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import type {
  EscrowListQueryDto,
  FundEscrowDto,
  ResolveDisputeDto,
} from './dto/index.js';

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

// Stripe amounts are in the currency's minor unit; LKR (the only currency in
// use) is 2-decimal, so this is a plain cents conversion.
const toMinorUnits = (amount: number) => Math.round(amount * 100);

@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly notifications: NotificationsService,
  ) {}

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

  // Admin/support monitoring: every escrow, newest first, optionally filtered by
  // status. Transactions are omitted from the list payload - the detail view
  // (getById, which staff can load via loadParty) carries the full ledger.
  async listAll(query: EscrowListQueryDto) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.jobEscrow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          job: { select: { id: true, title: true, status: true } },
          homeowner: { select: { id: true, name: true, image: true } },
          tradesman: { select: { id: true, name: true, image: true } },
        },
      }),
      this.prisma.jobEscrow.count({ where }),
    ]);
    return {
      data: rows.map((e) => ({
        id: e.id,
        jobId: e.jobId,
        status: e.status,
        currency: e.currency,
        quoteTotal: dec(e.quoteTotal),
        depositAmount: dec(e.depositAmount),
        balanceAmount: dec(e.balanceAmount),
        fundedAt: e.fundedAt,
        releasedAt: e.releasedAt,
        refundedAt: e.refundedAt,
        createdAt: e.createdAt,
        job: e.job,
        homeowner: e.homeowner,
        tradesman: e.tradesman,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
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
  // `card` goes through real Stripe (collection only - see StripeService);
  // `paypal`/`local` remain stubbed (real integrations are Phase C) with a
  // simulated reference, same as before.
  async fund(userId: string, escrowId: string, dto: FundEscrowDto) {
    const escrow = await this.loadParty(escrowId, userId);
    if (escrow.homeownerId !== userId) {
      throw new ForbiddenException('Only the homeowner can fund the deposit');
    }
    if (escrow.status !== 'REQUESTED') {
      throw new ConflictException('Deposit is not awaiting funding');
    }

    if (dto.paymentMethod === 'card') {
      return this.fundWithCard(escrow, dto);
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

  // Creates (or reuses, on retry/3DS-completion) a PaymentIntent and confirms
  // it with the client-collected card. Finalizes synchronously on immediate
  // success; returns a clientSecret for 3DS when Stripe requires it - the
  // webhook (`confirmFundedByPaymentIntent`) is the authoritative fallback for
  // that path and a safety net against duplicate/late delivery either way.
  private async fundWithCard(escrow: EscrowWithRelations, dto: FundEscrowDto) {
    if (!dto.stripePaymentMethodId) {
      throw new BadRequestException(
        'stripePaymentMethodId is required for card payments',
      );
    }

    let paymentIntent = escrow.stripePaymentIntentId
      ? await this.stripe.retrievePaymentIntent(escrow.stripePaymentIntentId)
      : null;

    if (!paymentIntent) {
      paymentIntent = await this.stripe.createAndConfirmPaymentIntent({
        amount: toMinorUnits(dec(escrow.depositAmount)),
        currency: escrow.currency.toLowerCase(),
        paymentMethodId: dto.stripePaymentMethodId,
        metadata: { escrowId: escrow.id },
      });
      await this.prisma.jobEscrow.update({
        where: { id: escrow.id },
        data: {
          stripePaymentIntentId: paymentIntent.id,
          paymentMethod: 'card',
        },
      });
    }

    if (paymentIntent.status === 'succeeded') {
      return this.finalizeFunded(escrow.id, paymentIntent.id);
    }
    if (paymentIntent.status === 'requires_action') {
      return {
        ...this.serialize(escrow),
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
      };
    }
    throw new BadRequestException(
      paymentIntent.last_payment_error?.message ??
        `Payment could not be completed (status: ${paymentIntent.status})`,
    );
  }

  // Idempotent: no-ops if the escrow has already moved past REQUESTED (e.g.
  // finalized synchronously in fund(), or a duplicate webhook delivery).
  private async finalizeFunded(escrowId: string, paymentIntentId: string) {
    const current = await this.prisma.jobEscrow.findUnique({
      where: { id: escrowId },
      include: ESCROW_INCLUDE,
    });
    if (!current) throw new NotFoundException('Escrow not found');
    if (current.status !== 'REQUESTED') {
      return this.serialize(current);
    }
    const updated = await this.prisma.jobEscrow.update({
      where: { id: escrowId },
      data: {
        status: 'FUNDED',
        paymentMethod: 'card',
        paymentRef: paymentIntentId,
        fundedAt: new Date(),
        transactions: {
          create: {
            type: 'FUND',
            amount: current.depositAmount,
            note: 'Deposit funded via card (Stripe)',
          },
        },
      },
      include: ESCROW_INCLUDE,
    });
    // Only the caller that actually transitions REQUESTED → FUNDED reaches here
    // (the sync + webhook paths are deduped by the guard above), so the tradesman
    // is told exactly once that the deposit is funded. Best-effort.
    await this.notifications.notifyEscrowFunded(current.jobId);
    return this.serialize(updated);
  }

  // Called only from the Stripe webhook controller once payment_intent.succeeded
  // fires - the authoritative confirmation path for 3DS completions and a
  // duplicate-safe fallback for the synchronous path.
  async confirmFundedByPaymentIntent(paymentIntentId: string): Promise<void> {
    const escrow = await this.prisma.jobEscrow.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!escrow) return;
    await this.finalizeFunded(escrow.id, paymentIntentId);
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
    // Job moved to IN_PROGRESS - tell the homeowner work has started.
    await this.notifications.notifyWorkStarted(escrow.jobId);
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
    // Tell the homeowner to review and approve so the balance is released.
    await this.notifications.notifyWorkSubmitted(escrow.jobId);
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
    // Job completed and balance released - tell the tradesman they were paid.
    await this.notifications.notifyJobCompleted(escrow.jobId);
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

    const isCard =
      escrow.paymentMethod === 'card' && escrow.stripePaymentIntentId;
    if (isCard) {
      // Let a Stripe error abort the request before any DB write.
      await this.stripe.createRefund({
        paymentIntentId: escrow.stripePaymentIntentId!,
      });
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
            note: isCard
              ? 'Deposit refunded to homeowner via Stripe'
              : 'Deposit refunded to homeowner',
          },
        },
      },
      include: ESCROW_INCLUDE,
    });
    return this.serialize(updated);
  }

  // Support/admin mediation for a disputed job (see ReportsService.create, which
  // pauses an in-progress job to DISPUTED on a party's complaint). The materials
  // deposit has usually already been released to the tradesman, so this is a
  // judgement call, not the plain pre-work `refund` above: staff cancel the job
  // and return some (or none, or all) of the deposit to the homeowner in one
  // atomic step. Refunding the deposit's original card charge - partially when
  // `refundAmount` is less than the deposit - is how the money actually flows
  // back. Any open reports on the job are closed as resolved.
  async resolveDispute(
    userId: string,
    escrowId: string,
    dto: ResolveDisputeDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== 'SUPPORT' && user?.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only support or admin can resolve disputes',
      );
    }

    const escrow = await this.prisma.jobEscrow.findUnique({
      where: { id: escrowId },
      include: ESCROW_INCLUDE,
    });
    if (!escrow) throw new NotFoundException('Escrow not found');

    if (escrow.job.status !== 'DISPUTED') {
      throw new ConflictException(
        'Only a job under dispute can be resolved through mediation',
      );
    }
    if (
      escrow.status === 'REFUNDED' ||
      escrow.status === 'RELEASED' ||
      escrow.status === 'CANCELLED'
    ) {
      throw new ConflictException('This escrow has already been settled');
    }

    const deposit = dec(escrow.depositAmount);
    // Round to the 2-decimal minor unit the schema already guarantees, then cap
    // at the deposit - Stripe can't refund more than the homeowner actually paid.
    const refundAmount = Math.round(dto.refundAmount * 100) / 100;
    if (refundAmount > deposit) {
      throw new BadRequestException(
        `Refund cannot exceed the ${deposit} deposit paid by the homeowner`,
      );
    }

    const isCard =
      escrow.paymentMethod === 'card' && !!escrow.stripePaymentIntentId;
    if (refundAmount > 0 && isCard) {
      // Let a Stripe error abort the request before any DB write.
      await this.stripe.createRefund({
        paymentIntentId: escrow.stripePaymentIntentId!,
        amount: toMinorUnits(refundAmount),
      });
    }

    const notes = dto.resolutionNotes?.trim();
    const isFull = refundAmount === deposit;
    const refundNote =
      `Dispute resolved by support - ${
        isFull ? 'full' : 'partial'
      } deposit refund` + (isCard ? ' via Stripe' : '');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: escrow.jobId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      // Close any still-open reports on this job - the mediation is their outcome.
      await tx.report.updateMany({
        where: {
          jobId: escrow.jobId,
          status: { in: ['OPEN', 'UNDER_REVIEW'] },
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          ...(notes ? { resolutionNotes: notes } : {}),
        },
      });
      return tx.jobEscrow.update({
        where: { id: escrowId },
        data: {
          // A settled dispute with money returned is REFUNDED; with nothing
          // returned (tradesman keeps the released deposit) it's CANCELLED.
          status: refundAmount > 0 ? 'REFUNDED' : 'CANCELLED',
          ...(refundAmount > 0 ? { refundedAt: new Date() } : {}),
          ...(refundAmount > 0
            ? {
                transactions: {
                  create: {
                    type: 'REFUND',
                    amount: refundAmount,
                    note: refundNote,
                  },
                },
              }
            : {}),
        },
        include: ESCROW_INCLUDE,
      });
    });

    await this.notifications.notifyDisputeResolved(escrow.jobId, {
      refundAmount,
      currency: escrow.currency,
    });
    return this.serialize(updated);
  }
}
