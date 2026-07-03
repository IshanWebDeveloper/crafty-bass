import { jest } from '@jest/globals';
import {
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { depositTier, maxDeposit } from '@repo/validation';
import { EscrowService } from './escrow.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { StripeService } from '../common/services/stripe.service.js';

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

// A card payment defaults to an immediate Stripe success — override methods
// per test for requires_action / retry scenarios.
function makeStripe(overrides: Record<string, unknown> = {}) {
  return {
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

// Narrow the recorded update() argument to read the status it wrote — the
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
    const service = new EscrowService(prisma, makeStripe());
    await service.fund('home1', 'esc1', { paymentMethod: 'paypal' });
    expect(statusWrittenBy(update)).toBe('FUNDED');
  });

  it('funds a requested deposit by the homeowner via a real Stripe card payment', async () => {
    const { prisma, update } = makePrisma(escrowRow({ status: 'REQUESTED' }));
    const stripe = makeStripe();
    const service = new EscrowService(prisma, stripe);
    await service.fund('home1', 'esc1', {
      paymentMethod: 'card',
      stripePaymentMethodId: 'pm_test123',
    });
    expect(stripe.createAndConfirmPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethodId: 'pm_test123',
        currency: 'lkr',
      }),
    );
    expect(statusWrittenBy(update)).toBe('FUNDED');
  });

  it('returns requiresAction when Stripe requires additional authentication', async () => {
    const { prisma, update } = makePrisma(escrowRow({ status: 'REQUESTED' }));
    const stripe = makeStripe({
      createAndConfirmPaymentIntent: jest.fn(
        (): Promise<unknown> =>
          Promise.resolve({
            id: 'pi_action',
            status: 'requires_action',
            client_secret: 'secret_action',
          }),
      ),
    });
    const service = new EscrowService(prisma, stripe);
    const result = (await service.fund('home1', 'esc1', {
      paymentMethod: 'card',
      stripePaymentMethodId: 'pm_test123',
    })) as { requiresAction?: boolean; clientSecret?: string };
    expect(result.requiresAction).toBe(true);
    expect(result.clientSecret).toBe('secret_action');
    // Not finalized yet — only the PaymentIntent-id bookkeeping update ran.
    expect(statusWrittenBy(update)).not.toBe('FUNDED');
  });

  it('rejects card funding without a stripePaymentMethodId', async () => {
    const { prisma } = makePrisma(escrowRow({ status: 'REQUESTED' }));
    const service = new EscrowService(prisma, makeStripe());
    await expect(
      service.fund('home1', 'esc1', { paymentMethod: 'card' }),
    ).rejects.toThrow('stripePaymentMethodId is required for card payments');
  });

  it('rejects funding by a non-homeowner', async () => {
    const { prisma } = makePrisma(escrowRow({ status: 'REQUESTED' }));
    const service = new EscrowService(prisma, makeStripe());
    await expect(
      service.fund('trade1', 'esc1', { paymentMethod: 'card' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to fund a deposit that is not awaiting funding', async () => {
    const { prisma } = makePrisma(escrowRow({ status: 'FUNDED' }));
    const service = new EscrowService(prisma, makeStripe());
    await expect(
      service.fund('home1', 'esc1', { paymentMethod: 'card' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets the tradesman release materials only once funded', async () => {
    const { prisma, update } = makePrisma(escrowRow({ status: 'FUNDED' }));
    const service = new EscrowService(prisma, makeStripe());
    await service.releaseMaterials('trade1', 'esc1');
    expect(statusWrittenBy(update)).toBe('MATERIALS_RELEASED');
  });

  it('releases the balance when the homeowner approves completed work', async () => {
    const { prisma, update } = makePrisma(
      escrowRow({ status: 'WORK_COMPLETED' }),
    );
    const service = new EscrowService(prisma, makeStripe());
    await service.approve('home1', 'esc1');
    expect(statusWrittenBy(update)).toBe('RELEASED');
  });

  it('refunds only a funded, unreleased deposit', async () => {
    const { prisma } = makePrisma(escrowRow({ status: 'MATERIALS_RELEASED' }));
    const service = new EscrowService(prisma, makeStripe());
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
    const service = new EscrowService(prisma, stripe);
    await service.refund('home1', 'esc1');
    expect(stripe.createRefund).toHaveBeenCalledWith({
      paymentIntentId: 'pi_test123',
    });
    expect(statusWrittenBy(update)).toBe('REFUNDED');
  });

  it('404s when the escrow does not exist', async () => {
    const { prisma } = makePrisma(escrowRow());
    (prisma.jobEscrow.findUnique as jest.Mock).mockResolvedValueOnce(
      null as never,
    );
    const service = new EscrowService(prisma, makeStripe());
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

    const service = new EscrowService(prisma, makeStripe());
    await service.confirmFundedByPaymentIntent('pi_abc');
    await service.confirmFundedByPaymentIntent('pi_abc');

    expect(update).toHaveBeenCalledTimes(1);
  });
});
