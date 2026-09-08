import { jest } from '@jest/globals';
import {
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { depositTier, maxDeposit } from '@repo/validation';
import { EscrowService } from './escrow.service.js';
import { EscrowInvoiceService } from './escrow-invoice.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { StripeService } from '../common/services/stripe.service.js';
import type { EmailService } from '../common/services/email.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';

// No-op notifications: the service fires best-effort lifecycle notices we don't
// assert on here.
function makeNotifications() {
  return {
    notifyEscrowFunded: jest.fn(() => Promise.resolve()),
    notifyWorkStarted: jest.fn(() => Promise.resolve()),
    notifyWorkSubmitted: jest.fn(() => Promise.resolve()),
    notifyJobCompleted: jest.fn(() => Promise.resolve()),
  } as unknown as NotificationsService;
}

// No-op mailer and the real (pure, dependency-free) invoice renderer - neither
// is exercised by the state-machine tests below.
function makeEmail() {
  return {
    send: jest.fn(() => Promise.resolve(true)),
  } as unknown as EmailService;
}
function makeInvoices() {
  return new EscrowInvoiceService();
}

// A minimal escrow row shaped like the ESCROW_INCLUDE payload the service reads.
function escrowRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'esc1',
    jobId: 'job1',
    quoteId: 'q1',
    homeownerId: 'home1',
    tradesmanId: 'trade1',
    currency: 'LKR',
    quoteTotal: 19200,
    materialsAmount: 9000,
    depositAmount: 5760,
    balanceAmount: 13440,
    status: 'REQUESTED',
    paymentMethod: null,
    stripePaymentIntentId: null,
    fundedAt: null,
    materialsReleasedAt: null,
    workCompletedAt: null,
    releasedAt: null,
    refundedAt: null,
    createdAt: new Date(),
    job: { id: 'job1', title: 'Fix shower', status: 'ASSIGNED' },
    homeowner: { id: 'home1', name: 'Nadia', image: null },
    tradesman: { id: 'trade1', name: 'Saman', image: null },
    transactions: [],
    ...overrides,
  };
}

function makePrisma(row: ReturnType<typeof escrowRow>) {
  const update = jest.fn((): Promise<unknown> => Promise.resolve(row));
  return {
    prisma: {
      jobEscrow: {
        findUnique: jest.fn((): Promise<unknown> => Promise.resolve(row)),
        update,
      },
      job: { update: jest.fn((): Promise<unknown> => Promise.resolve({})) },
      user: {
        findUnique: jest.fn(
          (): Promise<unknown> => Promise.resolve({ role: 'CUSTOMER' }),
        ),
      },
      $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          job: { update: jest.fn((): Promise<unknown> => Promise.resolve({})) },
          jobEscrow: { update },
        }),
      ),
    } as unknown as PrismaService,
    update,
  };
}

// A card payment opens a hosted Stripe Checkout session by default - override
// methods per test for the resume / already-paid scenarios.
function makeStripe(overrides: Record<string, unknown> = {}) {
  return {
    createCheckoutSession: jest.fn(
      (): Promise<unknown> =>
        Promise.resolve({
          id: 'cs_test123',
          status: 'open',
          url: 'https://checkout.stripe.com/c/pay/cs_test123',
        }),
    ),
    retrieveCheckoutSession: jest.fn(
      (): Promise<unknown> =>
        Promise.resolve({
          id: 'cs_test123',
          status: 'open',
          url: 'https://checkout.stripe.com/c/pay/cs_test123',
        }),
    ),
    createAndConfirmPaymentIntent: jest.fn(
      (): Promise<unknown> =>
        Promise.resolve({
          id: 'pi_test123',
          status: 'succeeded',
          client_secret: 'secret_test123',
        }),
    ),
    retrievePaymentIntent: jest.fn(
      (): Promise<unknown> =>
        Promise.resolve({ id: 'pi_test123', status: 'succeeded' }),
    ),
    createRefund: jest.fn(
      (): Promise<unknown> => Promise.resolve({ id: 're_test123' }),
    ),
    ...overrides,
  } as unknown as StripeService;
}

// Narrow the recorded update() argument to read the status it wrote - the
// card-funding path can issue more than one update() call (persisting the
// PaymentIntent id before finalizing), so scan from the most recent call for
// one that actually set a status.
function statusWrittenBy(update: jest.Mock): string {
  for (let i = update.mock.calls.length - 1; i >= 0; i--) {
    const arg = update.mock.calls[i]?.[0] as { data?: { status?: string } };
    if (arg?.data?.status) return arg.data.status;
  }
  return '';
}

describe('deposit tier (shared domain logic)', () => {
  it('locks unverified tradesmen out', () => {
    const t = depositTier({
      verified: false,
      rating: 5,
      completed: 999,
      bgChecked: true,
    });
    expect(t.key).toBe('none');
    expect(t.pct).toBe(0);
  });

  it('grades verified -> trusted -> background by rating and jobs', () => {
    expect(
      depositTier({
        verified: true,
        rating: 4.0,
        completed: 5,
        bgChecked: false,
      }).key,
    ).toBe('verified');
    expect(
      depositTier({
        verified: true,
        rating: 4.5,
        completed: 20,
        bgChecked: false,
      }).key,
    ).toBe('trusted');
    expect(
      depositTier({
        verified: true,
        rating: 4.8,
        completed: 60,
        bgChecked: true,
      }).key,
    ).toBe('background');
  });

  it('caps the deposit by tier and never above the materials line', () => {
    // Trusted: 30% of 100k = 30k, but materials line is only 12k.
    const trust = {
      verified: true,
      rating: 4.6,
      completed: 30,
      bgChecked: false,
    };
    expect(maxDeposit(trust, 100_000, 12_000)).toBe(12_000);
    // Verified tier cap is 15k even on a large job.
    const verified = {
      verified: true,
      rating: 4.0,
      completed: 1,
      bgChecked: false,
    };
    expect(maxDeposit(verified, 1_000_000, 500_000)).toBe(15_000);
  });
});

describe('EscrowService state machine', () => {
  it('funds a requested deposit by the homeowner (paypal, still simulated)', async () => {
    const { prisma, update } = makePrisma(escrowRow({ status: 'REQUESTED' }));
    const service = new EscrowService(
      prisma,
      makeStripe(),
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await service.fund('home1', 'esc1', { paymentMethod: 'paypal' });
    expect(statusWrittenBy(update)).toBe('FUNDED');
  });

  it('opens a hosted Stripe Checkout session for a card deposit', async () => {
    const { prisma, update } = makePrisma(escrowRow({ status: 'REQUESTED' }));
    const stripe = makeStripe();
    const service = new EscrowService(
      prisma,
      stripe,
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    const result = (await service.fund('home1', 'esc1', {
      paymentMethod: 'card',
      locale: 'en',
    })) as { checkoutUrl?: string };

    // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock method reference
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'lkr',
        // Deposit 5760 + 3% processing fee (172.80) = 5932.80 → 593280 minor units.
        amount: 593280,
        metadata: { escrowId: 'esc1' },
      }),
    );
    expect(result.checkoutUrl).toBe(
      'https://checkout.stripe.com/c/pay/cs_test123',
    );
    // The homeowner has not paid yet - only the session-id bookkeeping ran.
    // checkout.session.completed is what marks it FUNDED.
    expect(statusWrittenBy(update)).not.toBe('FUNDED');
  });

  it('reuses an open Checkout session instead of creating a second one', async () => {
    const { prisma } = makePrisma(
      escrowRow({ status: 'REQUESTED', stripeCheckoutSessionId: 'cs_open' }),
    );
    const stripe = makeStripe({
      retrieveCheckoutSession: jest.fn(
        (): Promise<unknown> =>
          Promise.resolve({
            id: 'cs_open',
            status: 'open',
            url: 'https://checkout.stripe.com/c/pay/cs_open',
          }),
      ),
    });
    const service = new EscrowService(
      prisma,
      stripe,
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    const result = (await service.fund('home1', 'esc1', {
      paymentMethod: 'card',
      locale: 'en',
    })) as { checkoutUrl?: string };

    expect(result.checkoutUrl).toBe(
      'https://checkout.stripe.com/c/pay/cs_open',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock method reference
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('settles a completed Checkout session if the webhook was missed', async () => {
    const { prisma, update } = makePrisma(
      escrowRow({ status: 'REQUESTED', stripeCheckoutSessionId: 'cs_done' }),
    );
    const stripe = makeStripe({
      retrieveCheckoutSession: jest.fn(
        (): Promise<unknown> =>
          Promise.resolve({
            id: 'cs_done',
            status: 'complete',
            payment_intent: 'pi_done',
          }),
      ),
    });
    const service = new EscrowService(
      prisma,
      stripe,
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await service.fund('home1', 'esc1', {
      paymentMethod: 'card',
      locale: 'en',
    });
    expect(statusWrittenBy(update)).toBe('FUNDED');
  });

  it('rejects funding by a non-homeowner', async () => {
    const { prisma } = makePrisma(escrowRow({ status: 'REQUESTED' }));
    const service = new EscrowService(
      prisma,
      makeStripe(),
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await expect(
      service.fund('trade1', 'esc1', { paymentMethod: 'card' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to fund a deposit that is not awaiting funding', async () => {
    const { prisma } = makePrisma(escrowRow({ status: 'FUNDED' }));
    const service = new EscrowService(
      prisma,
      makeStripe(),
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await expect(
      service.fund('home1', 'esc1', { paymentMethod: 'card' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets the tradesman release materials only once funded', async () => {
    const { prisma, update } = makePrisma(escrowRow({ status: 'FUNDED' }));
    const service = new EscrowService(
      prisma,
      makeStripe(),
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await service.releaseMaterials('trade1', 'esc1');
    expect(statusWrittenBy(update)).toBe('MATERIALS_RELEASED');
  });

  it('releases the balance when the homeowner approves completed work', async () => {
    const { prisma, update } = makePrisma(
      escrowRow({ status: 'WORK_COMPLETED' }),
    );
    const service = new EscrowService(
      prisma,
      makeStripe(),
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await service.approve('home1', 'esc1');
    expect(statusWrittenBy(update)).toBe('RELEASED');
  });

  it('refunds only a funded, unreleased deposit', async () => {
    const { prisma } = makePrisma(escrowRow({ status: 'MATERIALS_RELEASED' }));
    const service = new EscrowService(
      prisma,
      makeStripe(),
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await expect(service.refund('home1', 'esc1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refunds a card-funded deposit via Stripe', async () => {
    const { prisma, update } = makePrisma(
      escrowRow({
        status: 'FUNDED',
        paymentMethod: 'card',
        stripePaymentIntentId: 'pi_test123',
      }),
    );
    const stripe = makeStripe();
    const service = new EscrowService(
      prisma,
      stripe,
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await service.refund('home1', 'esc1');
    // Only the held deposit is refunded (5760 → 576000 minor units); the
    // processing fee is non-refundable.
    // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock method reference
    expect(stripe.createRefund).toHaveBeenCalledWith({
      paymentIntentId: 'pi_test123',
      amount: 576000,
    });
    expect(statusWrittenBy(update)).toBe('REFUNDED');
  });

  it('exposes the processing fee and amount due on the deposit', async () => {
    const { prisma } = makePrisma(escrowRow({ status: 'REQUESTED' }));
    const service = new EscrowService(
      prisma,
      makeStripe(),
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    const escrow = await service.getById('home1', 'esc1');
    // Deposit 5760, 3% fee = 172.80, amount due = 5932.80.
    expect(escrow.processingFee).toBeCloseTo(172.8);
    expect(escrow.amountDue).toBeCloseTo(5932.8);
  });

  it('404s when the escrow does not exist', async () => {
    const { prisma } = makePrisma(escrowRow());
    (prisma.jobEscrow.findUnique as jest.Mock).mockResolvedValueOnce(
      null as never,
    );
    const service = new EscrowService(
      prisma,
      makeStripe(),
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await expect(service.getById('home1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('confirmFundedByPaymentIntent is idempotent across duplicate webhook deliveries', async () => {
    const row = escrowRow({
      status: 'REQUESTED',
      stripePaymentIntentId: 'pi_abc',
    });
    const { prisma, update } = makePrisma(row);
    let currentStatus = 'REQUESTED';
    (prisma.jobEscrow.findUnique as jest.Mock).mockImplementation(
      (): Promise<unknown> =>
        Promise.resolve({ ...row, status: currentStatus }),
    );
    update.mockImplementation((): Promise<unknown> => {
      currentStatus = 'FUNDED';
      return Promise.resolve({ ...row, status: 'FUNDED' });
    });

    const service = new EscrowService(
      prisma,
      makeStripe(),
      makeNotifications(),
      makeEmail(),
      makeInvoices(),
    );
    await service.confirmFundedByPaymentIntent('pi_abc');
    await service.confirmFundedByPaymentIntent('pi_abc');

    expect(update).toHaveBeenCalledTimes(1);
  });
});
