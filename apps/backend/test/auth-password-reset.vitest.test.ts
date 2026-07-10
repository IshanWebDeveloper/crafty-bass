import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient, createDbAdapter } from '@repo/db';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@repo/auth';
import type { Application } from 'express';

import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock Resend to prevent real emails from being sent
vi.mock('resend', () => {
  return {
    Resend: class {
      emails = {
        send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
      };
    },
  };
});

// Since we're using Better Auth with a real database for integration tests,
// we don't mock AuthModule like in app.e2e-spec.ts
import { AppModule } from '../src/app.module.js';

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

    const httpAdapter = app.getHttpAdapter();
    const expressInstance = httpAdapter.getInstance() as Application;
    expressInstance.all('/api/auth/*splat', toNodeHandler(auth));

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
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'E2E Test User',
          privacyPolicyAcceptedAt: new Date().toISOString(),
        });
      if (res.status !== 200) {
        throw new Error(
          `Sign up failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }
    });

    afterAll(async () => {
      // Clean up. Better Auth stores the reset token as a verification row
      // whose `value` is the user id and whose `identifier` is
      // `reset-password:<token>`, so cascade-delete via the user id.
      const user = await prisma.user.findFirst({
        where: { email: testEmail },
      });

      if (user) {
        await prisma.verification.deleteMany({
          where: { value: user.id },
        });
        await prisma.user.deleteMany({
          where: { email: testEmail },
        });
      }
    });

    it('POST /api/auth/request-password-reset — succeeds for existing user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({
          email: testEmail,
          redirectTo: 'http://localhost:3000/reset-password',
        });

      // Better Auth returns 200 OK for successful forget-password requests
      expect(res.status).toBe(200);
      expect((res.body as { status: boolean }).status).toBe(true);

      // Better Auth persists the reset token as a verification row keyed by
      // `reset-password:<token>` with the user id as its value.
      const user = await prisma.user.findFirstOrThrow({
        where: { email: testEmail },
      });
      const verification = await prisma.verification.findFirst({
        where: {
          value: user.id,
          identifier: { startsWith: 'reset-password:' },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(verification).not.toBeNull();
      expect(verification?.identifier).toMatch(/^reset-password:/);
    });

    it('POST /api/auth/reset-password — succeeds with valid token', async () => {
      // First generate a token
      await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({
          email: testEmail,
          redirectTo: 'http://localhost:3000/reset-password',
        });

      const user = await prisma.user.findFirstOrThrow({
        where: { email: testEmail },
      });
      const verification = await prisma.verification.findFirst({
        where: {
          value: user.id,
          identifier: { startsWith: 'reset-password:' },
        },
        orderBy: { createdAt: 'desc' },
      });
      // The raw token is the suffix after the `reset-password:` prefix.
      const token = verification?.identifier.replace('reset-password:', '');

      // Reset the password using the generated token
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          newPassword: 'NewPassword123!',
          token,
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
