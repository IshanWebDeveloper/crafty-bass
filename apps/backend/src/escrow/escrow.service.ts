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
import { EmailService } from '../common/services/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import { escapeHtml } from '../common/utils/index.js';
import {
  EscrowInvoiceService,
  type EscrowInvoiceData,
} from './escrow-invoice.service.js';
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

// Round to the 2-decimal minor unit the schema guarantees.
const round2 = (amount: number) => Math.round(amount * 100) / 100;

// Payment processing is passed through to the homeowner as a transparent
// cost-recovery fee on the amount actually charged on-platform (the funded
// deposit). It is platform revenue - never part of the escrow-held funds nor the
// tradesman's payout - and is non-refundable (the processing cost is already
// incurred once the charge settles). Overridable via PLATFORM_PROCESSING_FEE_RATE;
// defaults to 3%.
const DEFAULT_PROCESSING_FEE_RATE = 0.03;
const processingFeeRate = (): number => {
  const raw = Number(process.env.PLATFORM_PROCESSING_FEE_RATE);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_PROCESSING_FEE_RATE;
};
const processingFeeFor = (depositAmount: number): number =>
  round2(depositAmount * processingFeeRate());
const feeNote = (depositAmount: number): string => {
  const fee = processingFeeFor(depositAmount);
  return fee > 0 ? ` (incl. ${fee} processing fee)` : '';
};

@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly invoices: EscrowInvoiceService,
  ) {}

  private serialize(e: EscrowWithRelations) {
    const deposit = dec(e.depositAmount);
    const processingFee = processingFeeFor(deposit);
    return {
      id: e.id,
      jobId: e.jobId,
      quoteId: e.quoteId,
      status: e.status,
      currency: e.currency,
      quoteTotal: dec(e.quoteTotal),
      materialsAmount: dec(e.materialsAmount),
      depositAmount: deposit,
      balanceAmount: dec(e.balanceAmount),
      // The up-front processing fee and what the homeowner actually pays at
      // funding (deposit + fee). Derived, not stored - it's platform revenue, not
      // escrow-held money.
      processingFee,
      amountDue: round2(deposit + processingFee),
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

  // --- Deposit invoice ---------------------------------------------------------
  //
  // Once the deposit has been funded, either party (or support) can obtain a PDF
  // invoice for the payment that settled - the deposit plus the non-refundable
  // processing fee. Available for any escrow that has been funded at least once
  // (`fundedAt` set), including later states and post-refund, since the payment
  // did happen. A still-REQUESTED escrow has no payment to invoice.

  private async buildInvoiceData(
    escrow: EscrowWithRelations,
  ): Promise<EscrowInvoiceData> {
    const deposit = dec(escrow.depositAmount);
    const processingFee = processingFeeFor(deposit);
    // Kept out of the shared ESCROW_INCLUDE so the serialized escrow never leaks
    // the homeowner's email to the tradesman; the invoice needs it for "Billed to".
    const homeowner = await this.prisma.user.findUnique({
      where: { id: escrow.homeownerId },
      select: { email: true },
    });
    const funded = escrow.fundedAt ?? escrow.createdAt;
    return {
      // Short, stable, human-referenceable: the escrow id's leading block, upper-cased.
      invoiceNumber: escrow.id.split('-')[0]?.toUpperCase() ?? escrow.id,
      issueDate: funded,
      currency: escrow.currency,
      jobId: escrow.jobId,
      jobTitle: escrow.job.title,
      homeownerName: escrow.homeowner.name,
      homeownerEmail: homeowner?.email ?? '',
      tradesmanName: escrow.tradesman.name,
      paymentMethod: escrow.paymentMethod ?? 'card',
      paymentRef: escrow.paymentRef,
      depositAmount: deposit,
      processingFee,
      amountPaid: round2(deposit + processingFee),
      balanceAmount: dec(escrow.balanceAmount),
      quoteTotal: dec(escrow.quoteTotal),
    };
  }

  // Loads the escrow (party/support only), asserts it has been funded, and
  // returns the rendered PDF plus a download filename.
  private async loadInvoice(userId: string, escrowId: string) {
    const escrow = await this.loadParty(escrowId, userId);
    if (!escrow.fundedAt) {
      throw new ConflictException(
        'No invoice yet - the deposit for this job has not been paid',
      );
    }
    const data = await this.buildInvoiceData(escrow);
    const pdf = await this.invoices.render(data);
    return { escrow, pdf, filename: this.invoices.fileName(data) };
  }

  /** The funded deposit's invoice as a PDF buffer, for download. */
  async getInvoice(userId: string, escrowId: string) {
    const { pdf, filename } = await this.loadInvoice(userId, escrowId);
    return { pdf, filename };
  }

  /**
   * Emails the deposit invoice to the requesting party ("email me a copy").
   * Best-effort like the rest of the mail path: returns whether it was sent
   * (false when no mail provider is configured) rather than failing the request.
   */
  async emailInvoice(userId: string, escrowId: string) {
    const { pdf, filename } = await this.loadInvoice(userId, escrowId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user?.email) {
      throw new NotFoundException('No email address on file for your account');
    }
    const sent = await this.email.send({
      to: user.email,
      subject: 'Your Crafty Bass deposit invoice',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Your deposit invoice</h2>
          <p>Hi ${escapeHtml(user.name)},</p>
          <p>Your deposit payment invoice is attached as a PDF. Thanks for using Crafty Bass.</p>
        </div>
      `,
      attachments: [{ filename, content: pdf }],
    });
    return { sent, email: user.email };
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
            note:
              `Deposit funded via ${dto.paymentMethod}` +
              feeNote(dec(escrow.depositAmount)),
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
    // Card deposits go through Stripe's hosted Checkout: this returns a
    // Stripe-hosted URL and the browser leaves our origin, so no card data
    // touches the app. Funding is confirmed by the checkout.session.completed
    // webhook - never by the redirect back, which the homeowner can skip,
    // replay, or hand-craft.
    if (escrow.stripeCheckoutSessionId) {
      const existing = await this.stripe.retrieveCheckoutSession(
        escrow.stripeCheckoutSessionId,
      );

      // Already paid, but the webhook hasn't landed (or was missed): settle it
      // here so the homeowner isn't stuck looking at an unfunded deposit.
      if (existing.status === 'complete') {
        const intentId =
          typeof existing.payment_intent === 'string'
            ? existing.payment_intent
            : existing.payment_intent?.id;
        if (intentId) {
          return this.finalizeFunded(escrow.id, intentId);
        }
      }

      // Still open - reuse it rather than stranding a second session.
      if (existing.status === 'open' && existing.url) {
        return { ...this.serialize(escrow), checkoutUrl: existing.url };
      }
    }

    // The homeowner is charged the deposit plus the processing fee; only the
    // deposit is held in escrow (the fee is platform revenue).
    const deposit = dec(escrow.depositAmount);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const jobUrl = `${frontendUrl}/${dto.locale ?? 'en'}/jobs/${escrow.jobId}`;

    const session = await this.stripe.createCheckoutSession({
      amount: toMinorUnits(deposit + processingFeeFor(deposit)),
      currency: escrow.currency.toLowerCase(),
      productName: `Deposit to start - ${escrow.job.title}`,
      metadata: { escrowId: escrow.id },
      successUrl: `${jobUrl}?funded=1`,
      cancelUrl: `${jobUrl}/fund?cancelled=1`,
    });

    if (!session.url) {
      throw new BadRequestException(
        'Stripe did not return a Checkout URL - the deposit was not charged.',
      );
    }

    await this.prisma.jobEscrow.update({
      where: { id: escrow.id },
      data: {
        stripeCheckoutSessionId: session.id,
        paymentMethod: 'card',
      },
    });

    return { ...this.serialize(escrow), checkoutUrl: session.url };
  }

  /**
   * checkout.session.completed handler. The session carries the escrow id in
   * metadata (set at creation), so this works even when the PaymentIntent id
   * has not been recorded against the escrow yet. Idempotent via
   * finalizeFunded's REQUESTED guard.
   */
  async confirmFundedByCheckoutSession(session: {
    id: string;
    metadata: Record<string, string> | null;
    payment_intent: string | { id: string } | null;
  }): Promise<void> {
    const escrowId = session.metadata?.escrowId;
    if (!escrowId) return;

    const intentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!intentId) return;

    const escrow = await this.prisma.jobEscrow.findUnique({
      where: { id: escrowId },
      select: { id: true, stripePaymentIntentId: true },
    });
    if (!escrow) return;

    // Record the PaymentIntent so refunds and a late payment_intent.succeeded
    // can both find this escrow.
    if (escrow.stripePaymentIntentId !== intentId) {
      await this.prisma.jobEscrow.update({
        where: { id: escrowId },
        data: { stripePaymentIntentId: intentId },
      });
    }

    await this.finalizeFunded(escrowId, intentId);
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
            note:
              'Deposit funded via card (Stripe)' +
              feeNote(dec(current.depositAmount)),
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
      // Let a Stripe error abort the request before any DB write. Refund only the
      // held deposit - the processing fee is non-refundable (cost already incurred).
      await this.stripe.createRefund({
        paymentIntentId: escrow.stripePaymentIntentId!,
        amount: toMinorUnits(dec(escrow.depositAmount)),
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
