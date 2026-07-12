import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import { PrismaClient, createDbAdapter } from '@repo/db';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@repo/auth';
import type { Application } from 'express';
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

// Keep real emails from being sent while still exercising the real auth stack.
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }) };
  },
}));

import { AppModule } from '../src/app.module.js';

// Turn a Set-Cookie response into a Cookie request header.
function cookieHeader(res: Response): string {
  const raw = (res.headers['set-cookie'] ?? []) as unknown as string[];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

describe('Job → Quote → Escrow lifecycle (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  // Unique per run so parallel/previous runs never collide and cleanup is scoped.
  const run = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  const password = 'Password123!';
  const homeownerEmail = `e2e-home-${run}@example.com`;
  const tradesmanEmail = `e2e-trade-${run}@example.com`;
  const unverifiedEmail = `e2e-unverified-${run}@example.com`;

  let homeownerCookie = '';
  let tradesmanCookie = '';
  let unverifiedCookie = '';
  let jobId = '';
  let quoteId = '';
  let escrowId = '';

  // autoSignIn is on, so a successful sign-up already carries a session cookie.
  async function signUp(email: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        email,
        password,
        name,
        privacyPolicyAcceptedAt: new Date().toISOString(),
      });
    if (res.status !== 200) {
      throw new Error(
        `sign-up failed: ${res.status} ${JSON.stringify(res.body)}`,
      );
    }
    const userId = (res.body as { user: { id: string } }).user.id;
    return { cookie: cookieHeader(res), userId };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['api/auth/{*path}'] });
    const expressInstance = app.getHttpAdapter().getInstance() as Application;
    expressInstance.all('/api/auth/*splat', toNodeHandler(auth));
    prisma = new PrismaClient({ adapter: createDbAdapter() });
    await app.init();

    const home = await signUp(homeownerEmail, 'E2E Homeowner');
    homeownerCookie = home.cookie;
    const trade = await signUp(tradesmanEmail, 'E2E Tradesman');
    tradesmanCookie = trade.cookie;
    const unverified = await signUp(unverifiedEmail, 'E2E Unverified');
    unverifiedCookie = unverified.cookie;

    // Give the primary tradesman a verified profile so a materials deposit sits
    // within their trust tier (trusted: 30% / 40 000 cap → capped by materials).
    await prisma.user.update({
      where: { id: trade.userId },
      data: { userType: 'TRADESMAN' },
    });
    await prisma.tradesmanProfile.create({
      data: {
        userId: trade.userId,
        isVerified: true,
        avgRating: 4.6,
        jobsCompleted: 25,
      },
    });
  });

  afterAll(async () => {
    // Cascades clean jobs/quotes/escrows/profiles owned by these users.
    await prisma.user.deleteMany({ where: { email: { contains: run } } });
    await prisma.verification.deleteMany({
      where: { identifier: { contains: run } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('homeowner posts a job (OPEN)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/jobs')
      .set('Cookie', homeownerCookie)
      .send({
        title: 'Fix a leaking kitchen tap',
        description:
          'The kitchen tap has been dripping for a week and needs a new washer.',
      });
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('OPEN');
    jobId = (res.body as { id: string }).id;
  });

  it('verified tradesman quotes with server-computed totals', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/quotes`)
      .set('Cookie', tradesmanCookie)
      .send({
        lineItems: [
          { category: 'LABOUR', name: 'Labour', quantity: 2, unitPrice: 5000 },
          {
            category: 'MATERIAL',
            name: 'Washer + fittings',
            quantity: 1,
            unitPrice: 3000,
          },
        ],
        calloutFee: 500,
        discount: 500,
        applyVat: false,
        depositRequested: 3000,
      });
    expect(res.status).toBe(201);
    const body = res.body as {
      id: string;
      amount: string;
      materialsAmount: string;
    };
    expect(Number(body.amount)).toBe(13000);
    expect(Number(body.materialsAmount)).toBe(3000);
    quoteId = body.id;
  });

  it('only the job owner can list its quotes', async () => {
    const asTradesman = await request(app.getHttpServer())
      .get(`/api/v1/jobs/${jobId}/quotes`)
      .set('Cookie', tradesmanCookie);
    expect(asTradesman.status).toBe(403);

    const asOwner = await request(app.getHttpServer())
      .get(`/api/v1/jobs/${jobId}/quotes`)
      .set('Cookie', homeownerCookie);
    expect(asOwner.status).toBe(200);
    expect((asOwner.body as unknown[]).length).toBe(1);
  });

  it('rejects a deposit from an unverified tradesman', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/quotes`)
      .set('Cookie', unverifiedCookie)
      .send({
        lineItems: [
          {
            category: 'MATERIAL',
            name: 'Materials',
            quantity: 1,
            unitPrice: 5000,
          },
        ],
        depositRequested: 1000,
      });
    expect(res.status).toBe(400);
  });

  it('owner accepts the quote → job ASSIGNED, escrow REQUESTED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/quotes/${quoteId}/accept`)
      .set('Cookie', homeownerCookie);
    expect(res.status).toBe(200);

    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe('ASSIGNED');

    const escrow = await prisma.jobEscrow.findFirstOrThrow({
      where: { jobId },
    });
    expect(escrow.status).toBe('REQUESTED');
    expect(Number(escrow.depositAmount)).toBe(3000);
    expect(Number(escrow.balanceAmount)).toBe(10000);
    escrowId = escrow.id;
  });

  it('homeowner funds the deposit via paypal → FUNDED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/escrows/${escrowId}/fund`)
      .set('Cookie', homeownerCookie)
      .send({ paymentMethod: 'paypal' });
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('FUNDED');
  });

  it('tradesman releases materials and marks work done, owner approves → RELEASED', async () => {
    const release = await request(app.getHttpServer())
      .post(`/api/v1/escrows/${escrowId}/release-materials`)
      .set('Cookie', tradesmanCookie);
    expect(release.status).toBe(201);
    expect((release.body as { status: string }).status).toBe(
      'MATERIALS_RELEASED',
    );

    const done = await request(app.getHttpServer())
      .post(`/api/v1/escrows/${escrowId}/work-done`)
      .set('Cookie', tradesmanCookie);
    expect(done.status).toBe(201);
    expect((done.body as { status: string }).status).toBe('WORK_COMPLETED');

    const approve = await request(app.getHttpServer())
      .post(`/api/v1/escrows/${escrowId}/approve`)
      .set('Cookie', homeownerCookie);
    expect(approve.status).toBe(201);
    expect((approve.body as { status: string }).status).toBe('RELEASED');
  });

  it('rejects an unauthenticated job post', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/jobs')
      .send({ title: 'No session', description: 'Should be rejected as 401.' });
    expect(res.status).toBe(401);
  });
});
