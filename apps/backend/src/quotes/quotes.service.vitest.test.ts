// vitest types `expect.objectContaining` as `any`, so nesting it as an object
// property value trips no-unsafe-assignment on otherwise-correct assertions.
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { QuotesService } from './quotes.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateQuoteDto } from './dto/index.js';

// No-op notifications: the service fires best-effort lifecycle notices we don't
// assert on here.
function makeNotifications() {
  return {
    notifyQuoteDecision: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;
}

// ── Mock Prisma ────────────────────────────────────────────────────────────
// Mirrors the escrow.service.spec.ts style: hand-rolled vi.fn()s, a
// $transaction that runs the callback against a tx double, and the service
// instantiated directly (no Nest DI).

interface PrismaOverrides {
  job?: Partial<{
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  }>;
  user?: Partial<{
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  }>;
  quote?: Partial<{
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  }>;
}

function makePrisma(overrides: PrismaOverrides = {}) {
  const tx = {
    quote: {
      update: vi.fn(() => Promise.resolve({ id: 'q1', status: 'ACCEPTED' })),
      updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    job: { update: vi.fn(() => Promise.resolve({})) },
    jobEscrow: { create: vi.fn(() => Promise.resolve({})) },
  };
  const prisma = {
    job: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      update: vi.fn(() => Promise.resolve({})),
      ...overrides.job,
    },
    user: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      update: vi.fn(() => Promise.resolve({})),
      ...overrides.user,
    },
    quote: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn((args: unknown) => Promise.resolve({ id: 'q1', args })),
      update: vi.fn(() => Promise.resolve({ id: 'q1' })),
      updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
      ...overrides.quote,
    },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  return { prisma, tx };
}

// A tradesman profile that lands on the 'trusted' tier (rating ≥ 4.5,
// completed ≥ 20) → 30% / 40 000 cap, so a materials deposit is capped by the
// 3 000 materials line below.
function verifiedTradesman() {
  return {
    userType: 'TRADESMAN',
    tradesmanProfile: {
      isVerified: true,
      avgRating: 4.6,
      jobsCompleted: 25,
      backgroundChecked: false,
    },
  };
}

// labour 2×5000 + material 1×3000 + callout 500 − discount 500 = 13 000
// → +18% VAT = 15 340 total; materials line = 3 000.
function quoteDto(overrides: Partial<CreateQuoteDto> = {}): CreateQuoteDto {
  return {
    lineItems: [
      { category: 'LABOUR', name: 'Labour', quantity: 2, unitPrice: 5000 },
      { category: 'MATERIAL', name: 'Pipe', quantity: 1, unitPrice: 3000 },
    ],
    calloutFee: 500,
    discount: 500,
    applyVat: true,
    validityDays: 14,
    currency: 'LKR',
    ...overrides,
  } as CreateQuoteDto;
}

describe('QuotesService.create', () => {
  let service: QuotesService;
  let prismaBits: ReturnType<typeof makePrisma>;

  function build(overrides: PrismaOverrides = {}) {
    prismaBits = makePrisma(overrides);
    service = new QuotesService(
      prismaBits.prisma as unknown as PrismaService,
      makeNotifications(),
    );
  }

  beforeEach(() => build());

  it('throws NotFound when the job does not exist', async () => {
    build({ job: { findUnique: vi.fn(() => Promise.resolve(null)) } });
    await expect(
      service.create('u1', 'job1', quoteDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids quoting on your own job', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: 'job1', homeownerId: 'u1', status: 'OPEN' }),
        ),
      },
    });
    await expect(
      service.create('u1', 'job1', quoteDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('conflicts when the job is no longer OPEN', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'job1',
            homeownerId: 'owner',
            status: 'ASSIGNED',
          }),
        ),
      },
    });
    await expect(
      service.create('u1', 'job1', quoteDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('forbids HOMEOWNER userType from quoting', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: 'job1', homeownerId: 'owner', status: 'OPEN' }),
        ),
      },
      user: {
        findUnique: vi.fn(() => Promise.resolve({ userType: 'HOMEOWNER' })),
      },
    });
    await expect(
      service.create('u1', 'job1', quoteDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('promotes a null userType to TRADESMAN before creating', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: 'job1', homeownerId: 'owner', status: 'OPEN' }),
        ),
      },
      user: {
        findUnique: vi.fn(() =>
          Promise.resolve({ userType: null, tradesmanProfile: null }),
        ),
      },
    });
    await service.create('u1', 'job1', quoteDto({ depositRequested: 0 }));
    expect(prismaBits.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userType: 'TRADESMAN' } }),
    );
  });

  it('conflicts on a duplicate quote for the same job', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: 'job1', homeownerId: 'owner', status: 'OPEN' }),
        ),
      },
      user: { findUnique: vi.fn(() => Promise.resolve(verifiedTradesman())) },
      quote: { findUnique: vi.fn(() => Promise.resolve({ id: 'existing' })) },
    });
    await expect(
      service.create('u1', 'job1', quoteDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('computes amount, materialsAmount and vatRate server-side', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: 'job1', homeownerId: 'owner', status: 'OPEN' }),
        ),
      },
      user: { findUnique: vi.fn(() => Promise.resolve(verifiedTradesman())) },
    });
    await service.create('u1', 'job1', quoteDto({ depositRequested: 3000 }));
    expect(prismaBits.prisma.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 15340,
          materialsAmount: 3000,
          vatRate: 18,
        }),
      }),
    );
  });

  it('rejects a deposit above an unverified tradesman’s zero cap', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: 'job1', homeownerId: 'owner', status: 'OPEN' }),
        ),
      },
      user: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            userType: 'TRADESMAN',
            tradesmanProfile: {
              isVerified: false,
              avgRating: 0,
              jobsCompleted: 0,
              backgroundChecked: false,
            },
          }),
        ),
      },
    });
    await expect(
      service.create('u1', 'job1', quoteDto({ depositRequested: 1 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a deposit above a verified tradesman’s cap', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: 'job1', homeownerId: 'owner', status: 'OPEN' }),
        ),
      },
      user: { findUnique: vi.fn(() => Promise.resolve(verifiedTradesman())) },
    });
    // allowed = min(30% of 15 340, 40 000, materials 3 000) = 3 000
    await expect(
      service.create('u1', 'job1', quoteDto({ depositRequested: 3001 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a deposit within the cap', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: 'job1', homeownerId: 'owner', status: 'OPEN' }),
        ),
      },
      user: { findUnique: vi.fn(() => Promise.resolve(verifiedTradesman())) },
    });
    await service.create('u1', 'job1', quoteDto({ depositRequested: 3000 }));
    expect(prismaBits.prisma.quote.create).toHaveBeenCalledOnce();
  });

  it('sets validUntil ≈ now + validityDays', async () => {
    build({
      job: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: 'job1', homeownerId: 'owner', status: 'OPEN' }),
        ),
      },
      user: { findUnique: vi.fn(() => Promise.resolve(verifiedTradesman())) },
    });
    const before = Date.now();
    await service.create(
      'u1',
      'job1',
      quoteDto({ validityDays: 7, depositRequested: 0 }),
    );
    const call = prismaBits.prisma.quote.create.mock.calls[0][0] as {
      data: { validUntil: Date };
    };
    const expected = before + 7 * 24 * 60 * 60 * 1000;
    expect(call.data.validUntil.getTime()).toBeGreaterThanOrEqual(
      expected - 5000,
    );
    expect(call.data.validUntil.getTime()).toBeLessThanOrEqual(
      expected + 5 * 60 * 1000,
    );
  });
});

describe('QuotesService.accept', () => {
  function pendingQuote(overrides: Record<string, unknown> = {}) {
    return {
      id: 'q1',
      status: 'PENDING',
      jobId: 'job1',
      tradesmanId: 'trade1',
      currency: 'LKR',
      amount: 15340,
      materialsAmount: 3000,
      depositRequested: 3000,
      job: { id: 'job1', homeownerId: 'owner', status: 'OPEN' },
      ...overrides,
    };
  }

  it('throws NotFound for a missing quote', async () => {
    const { prisma } = makePrisma({
      quote: { findUnique: vi.fn(() => Promise.resolve(null)) },
    });
    await expect(
      new QuotesService(
        prisma as unknown as PrismaService,
        makeNotifications(),
      ).accept('owner', 'q1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids a non-owner from accepting', async () => {
    const { prisma } = makePrisma({
      quote: { findUnique: vi.fn(() => Promise.resolve(pendingQuote())) },
    });
    await expect(
      new QuotesService(
        prisma as unknown as PrismaService,
        makeNotifications(),
      ).accept('someone', 'q1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('conflicts when the job is not OPEN', async () => {
    const { prisma } = makePrisma({
      quote: {
        findUnique: vi.fn(() =>
          Promise.resolve(
            pendingQuote({
              job: { id: 'job1', homeownerId: 'owner', status: 'ASSIGNED' },
            }),
          ),
        ),
      },
    });
    await expect(
      new QuotesService(
        prisma as unknown as PrismaService,
        makeNotifications(),
      ).accept('owner', 'q1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('conflicts when the quote is not PENDING', async () => {
    const { prisma } = makePrisma({
      quote: {
        findUnique: vi.fn(() =>
          Promise.resolve(pendingQuote({ status: 'REJECTED' })),
        ),
      },
    });
    await expect(
      new QuotesService(
        prisma as unknown as PrismaService,
        makeNotifications(),
      ).accept('owner', 'q1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('assigns the job, rejects other quotes and escrows the deposit', async () => {
    const { prisma, tx } = makePrisma({
      quote: { findUnique: vi.fn(() => Promise.resolve(pendingQuote())) },
    });
    await new QuotesService(
      prisma as unknown as PrismaService,
      makeNotifications(),
    ).accept('owner', 'q1');
    expect(tx.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      }),
    );
    expect(tx.quote.updateMany).toHaveBeenCalled();
    expect(tx.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ASSIGNED' }),
      }),
    );
    expect(tx.jobEscrow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          depositAmount: 3000,
          balanceAmount: 12340,
        }),
      }),
    );
  });

  it('creates no escrow when no deposit was requested', async () => {
    const { prisma, tx } = makePrisma({
      quote: {
        findUnique: vi.fn(() =>
          Promise.resolve(pendingQuote({ depositRequested: null })),
        ),
      },
    });
    await new QuotesService(
      prisma as unknown as PrismaService,
      makeNotifications(),
    ).accept('owner', 'q1');
    expect(tx.jobEscrow.create).not.toHaveBeenCalled();
  });
});

describe('QuotesService.reject / withdraw', () => {
  it('reject: forbids a non-owner', async () => {
    const { prisma } = makePrisma({
      quote: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'q1',
            status: 'PENDING',
            job: { homeownerId: 'owner' },
          }),
        ),
      },
    });
    await expect(
      new QuotesService(
        prisma as unknown as PrismaService,
        makeNotifications(),
      ).reject('nope', 'q1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reject: conflicts when not PENDING', async () => {
    const { prisma } = makePrisma({
      quote: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'q1',
            status: 'ACCEPTED',
            job: { homeownerId: 'owner' },
          }),
        ),
      },
    });
    await expect(
      new QuotesService(
        prisma as unknown as PrismaService,
        makeNotifications(),
      ).reject('owner', 'q1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reject: happy path marks the quote REJECTED', async () => {
    const update = vi.fn(() =>
      Promise.resolve({ id: 'q1', status: 'REJECTED' }),
    );
    const { prisma } = makePrisma({
      quote: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'q1',
            status: 'PENDING',
            job: { homeownerId: 'owner' },
          }),
        ),
        update,
      },
    });
    await new QuotesService(
      prisma as unknown as PrismaService,
      makeNotifications(),
    ).reject('owner', 'q1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' }),
      }),
    );
  });

  it('withdraw: forbids a non-author', async () => {
    const { prisma } = makePrisma({
      quote: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'q1',
            tradesmanId: 'trade1',
            status: 'PENDING',
          }),
        ),
      },
    });
    await expect(
      new QuotesService(
        prisma as unknown as PrismaService,
        makeNotifications(),
      ).withdraw('other', 'q1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('withdraw: conflicts when not PENDING', async () => {
    const { prisma } = makePrisma({
      quote: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'q1',
            tradesmanId: 'trade1',
            status: 'ACCEPTED',
          }),
        ),
      },
    });
    await expect(
      new QuotesService(
        prisma as unknown as PrismaService,
        makeNotifications(),
      ).withdraw('trade1', 'q1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('withdraw: happy path marks the quote WITHDRAWN', async () => {
    const update = vi.fn(() =>
      Promise.resolve({ id: 'q1', status: 'WITHDRAWN' }),
    );
    const { prisma } = makePrisma({
      quote: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'q1',
            tradesmanId: 'trade1',
            status: 'PENDING',
          }),
        ),
        update,
      },
    });
    await new QuotesService(
      prisma as unknown as PrismaService,
      makeNotifications(),
    ).withdraw('trade1', 'q1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'WITHDRAWN' }),
      }),
    );
  });
});
