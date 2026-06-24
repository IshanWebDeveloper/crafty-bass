import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { VerificationService } from './verification.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';

function makePrisma(submission: Record<string, unknown> | null) {
  const profileUpsert = jest.fn((): Promise<unknown> => Promise.resolve({}));
  const verificationUpdate = jest.fn(
    (): Promise<unknown> => Promise.resolve({}),
  );
  return {
    prisma: {
      tradesmanVerification: {
        findUnique: jest.fn(
          (): Promise<unknown> => Promise.resolve(submission),
        ),
        update: verificationUpdate,
        upsert: jest.fn((): Promise<unknown> => Promise.resolve({})),
        count: jest.fn((): Promise<number> => Promise.resolve(0)),
        findMany: jest.fn((): Promise<unknown[]> => Promise.resolve([])),
      },
      tradesmanProfile: { upsert: profileUpsert },
      user: { update: jest.fn((): Promise<unknown> => Promise.resolve({})) },
      $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          tradesmanProfile: { upsert: profileUpsert },
          tradesmanVerification: { update: verificationUpdate },
          user: {
            update: jest.fn((): Promise<unknown> => Promise.resolve({})),
          },
        }),
      ),
    } as unknown as PrismaService,
    profileUpsert,
    verificationUpdate,
  };
}

describe('VerificationService.approve', () => {
  it('marks the profile verified but not background-checked without a police report', async () => {
    const { prisma, profileUpsert } = makePrisma({
      id: 'v1',
      userId: 'u1',
      status: 'PENDING',
      policeClearanceKey: null,
      yearsExperience: 3,
      serviceRadiusKm: 15,
      city: 'Colombo',
      district: 'Colombo',
    });
    const service = new VerificationService(prisma);
    await service.approve('admin1', 'v1');
    const arg = (profileUpsert.mock.calls as unknown[][])[0]?.[0] as {
      update: { isVerified: boolean; backgroundChecked: boolean };
    };
    expect(arg.update.isVerified).toBe(true);
    expect(arg.update.backgroundChecked).toBe(false);
  });

  it('unlocks the background-checked tier when a police report is attached', async () => {
    const { prisma, profileUpsert } = makePrisma({
      id: 'v1',
      userId: 'u1',
      status: 'PENDING',
      policeClearanceKey: 'docs/police-u1.pdf',
      yearsExperience: 3,
      serviceRadiusKm: 15,
      city: 'Colombo',
      district: 'Colombo',
    });
    const service = new VerificationService(prisma);
    await service.approve('admin1', 'v1');
    const arg = (profileUpsert.mock.calls as unknown[][])[0]?.[0] as {
      update: { backgroundChecked: boolean };
    };
    expect(arg.update.backgroundChecked).toBe(true);
  });

  it('404s on a missing submission', async () => {
    const { prisma } = makePrisma(null);
    const service = new VerificationService(prisma);
    await expect(service.approve('admin1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses to re-approve an approved submission', async () => {
    const { prisma } = makePrisma({
      id: 'v1',
      userId: 'u1',
      status: 'APPROVED',
      policeClearanceKey: null,
    });
    const service = new VerificationService(prisma);
    await expect(service.approve('admin1', 'v1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
