// vitest types `expect.objectContaining` as `any`, so nesting it as an object
// property value trips no-unsafe-assignment on otherwise-correct assertions.
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { EscrowService } from './escrow.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { StripeService } from '../common/services/stripe.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';

// No-op notifications: the service fires best-effort lifecycle notices we don't
// assert on here.
function makeNotifications() {
  return {
    notifyEscrowFunded: vi.fn().mockResolvedValue(undefined),
    notifyWorkStarted: vi.fn().mockResolvedValue(undefined),
    notifyWorkSubmitted: vi.fn().mockResolvedValue(undefined),
    notifyJobCompleted: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;
}

// A jobEscrow row shaped like the ESCROW_INCLUDE payload the service reads.
function escrowRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'esc1',
    jobId: 'job1',
    quoteId: 'q1',
    homeownerId: 'home1',
    tradesmanId: 'trade1',
    currency: 'LKR',
    quoteTotal: 15340,
    materialsAmount: 3000,
    depositAmount: 3000,
    balanceAmount: 12340,
    status: 'MATERIALS_RELEASED',
    paymentMethod: 'paypal',
    stripePaymentIntentId: null,
    fundedAt: new Date(),
    materialsReleasedAt: new Date(),
    workCompletedAt: null,
    releasedAt: null,
    refundedAt: null,
    createdAt: new Date(),
    job: { id: 'job1', title: 'Fix shower', status: 'IN_PROGRESS' },
    homeowner: { id: 'home1', name: 'Nadia', image: null },
    tradesman: { id: 'trade1', name: 'Saman', image: null },
    transactions: [],
    ...overrides,
  };
}

function makeService(row: ReturnType<typeof escrowRow>) {
  const update = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...row, ...args.data }),
  );
  const prisma = {
    jobEscrow: {
      findUnique: vi.fn(() => Promise.resolve(row)),
      update,
    },
    user: { findUnique: vi.fn(() => Promise.resolve({ role: 'CUSTOMER' })) },
  } as unknown as PrismaService;
  const stripe = {} as unknown as StripeService;
  return {
    service: new EscrowService(prisma, stripe, makeNotifications()),
    update,
  };
}

describe('EscrowService.markWorkDone', () => {
  it('lets only the tradesman mark work done', async () => {
    const { service } = makeService(escrowRow());
    // home1 is a party (homeowner) but not the tradesman → Forbidden.
    await expect(service.markWorkDone('home1', 'esc1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('conflicts unless the escrow is MATERIALS_RELEASED', async () => {
    const { service } = makeService(escrowRow({ status: 'FUNDED' }));
    await expect(service.markWorkDone('trade1', 'esc1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('transitions to WORK_COMPLETED and stamps workCompletedAt', async () => {
    const { service, update } = makeService(escrowRow());
    const result = await service.markWorkDone('trade1', 'esc1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'WORK_COMPLETED' }),
      }),
    );
    const arg = update.mock.calls[0][0] as { data: { workCompletedAt: Date } };
    expect(arg.data.workCompletedAt).toBeInstanceOf(Date);
    expect(result.status).toBe('WORK_COMPLETED');
  });
});
