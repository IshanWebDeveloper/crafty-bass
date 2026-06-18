/* eslint-disable @typescript-eslint/no-require-imports */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient, createDbAdapter } from '@repo/db';

import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock Resend to prevent real emails from being sent
vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
      },
    })),
  };
});

// Since we're using Better Auth with a real database for integration tests,
// we don't mock AuthModule like in app.e2e-spec.ts
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { AppModule } = require('../src/app.module');

describe('Authentication Flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Setup test module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['api/auth/{*path}'],
    });

    prisma = new PrismaClient({ adapter: createDbAdapter() });
    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Password Reset', () => {
    const testEmail = 'e2e-test-reset@example.com';
    const testPassword = 'Password123!';

    beforeAll(async () => {
      // Clean up previous test users if any
      await prisma.user.deleteMany({
        where: { email: testEmail },
      });

      // Register a real user to test against
      await request(app.getHttpServer()).post('/api/auth/sign-up/email').send({
        email: testEmail,
        password: testPassword,
        name: 'E2E Test User',
      });
    });

    afterAll(async () => {
      // Clean up
      const user = await prisma.user.findFirst({
        where: { email: testEmail },
      });

      if (user) {
        await prisma.verification.deleteMany({
          where: { identifier: testEmail },
        });
        await prisma.user.deleteMany({
          where: { email: testEmail },
        });
      }
    });

    it('POST /api/auth/forget-password — succeeds for existing user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/forget-password')
        .send({
          email: testEmail,
          redirectTo: 'http://localhost:3000/reset-password',
        });

      // Better Auth returns 200 OK for successful forget-password requests
      expect(res.status).toBe(200);
      expect((res.body as { status: boolean }).status).toBe(true);

      // Verify a token was saved in the DB
      const verification = await prisma.verification.findFirst({
        where: { identifier: testEmail },
      });
      expect(verification).toBeDefined();
      expect(verification?.value).toBeDefined();
    });

    it('POST /api/auth/reset-password — succeeds with valid token', async () => {
      // First generate a token
      await request(app.getHttpServer())
        .post('/api/auth/forget-password')
        .send({
          email: testEmail,
          redirectTo: 'http://localhost:3000/reset-password',
        });

      const verification = await prisma.verification.findFirst({
        where: { identifier: testEmail },
        orderBy: { createdAt: 'desc' },
      });

      // Reset the password using the generated token
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          newPassword: 'NewPassword123!',
          token: verification?.value,
        });

      expect(res.status).toBe(200);

      // Verify the user can log in with the NEW password
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({
          email: testEmail,
          password: 'NewPassword123!',
        });

      expect(loginRes.status).toBe(200);
      expect((loginRes.body as { user: unknown }).user).toBeDefined();
    });

    it('POST /api/auth/reset-password — fails with invalid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          newPassword: 'NewPassword123!',
          token: 'invalid-or-fake-token',
        });

      // Better Auth returns 400 or 401 for invalid tokens
      expect([400, 401, 403]).toContain(res.status);
    });
  });
});
