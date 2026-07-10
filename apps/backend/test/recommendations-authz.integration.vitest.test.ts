import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import { PrismaClient, createDbAdapter } from '@repo/db';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@repo/auth';
import type { Application } from 'express';
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }) };
  },
}));

import { AppModule } from '../src/app.module.js';

function cookieHeader(res: Response): string {
  const raw = (res.headers['set-cookie'] ?? []) as unknown as string[];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

describe('Job recommendations authorization (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const run = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  const password = 'Password123!';
  const ownerEmail = `e2e-recs-owner-${run}@example.com`;
  const otherEmail = `e2e-recs-other-${run}@example.com`;

  let ownerCookie = '';
  let otherCookie = '';
  let jobId = '';

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
    return cookieHeader(res);
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

    ownerCookie = await signUp(ownerEmail, 'E2E Recs Owner');
    otherCookie = await signUp(otherEmail, 'E2E Recs Other');

    const job = await request(app.getHttpServer())
      .post('/api/v1/jobs')
      .set('Cookie', ownerCookie)
      .send({
        title: 'Repaint the hallway',
        description:
          'Two coats of white emulsion on the upstairs hallway walls.',
      });
    jobId = (job.body as { id: string }).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: run } } });
    await prisma.verification.deleteMany({
      where: { identifier: { contains: run } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('returns an empty list to the job owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/recommendations/jobs/${jobId}`)
      .set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('forbids a non-owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/recommendations/jobs/${jobId}`)
      .set('Cookie', otherCookie);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/v1/recommendations/jobs/${jobId}`,
    );
    expect(res.status).toBe(401);
  });
});
