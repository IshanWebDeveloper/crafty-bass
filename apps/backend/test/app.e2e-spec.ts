/* eslint-disable @typescript-eslint/no-require-imports */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// ─── Mock auth infrastructure ───────────────────────────────────────────────
jest.mock('@thallesp/nestjs-better-auth', () => ({
  AuthModule: {
    forRoot: () => ({
      module: class MockAuthModule {},
    }),
  },
}));

jest.mock('../src/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue(null),
      userHasPermission: jest.fn().mockResolvedValue({ success: false }),
    },
  },
}));

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn().mockReturnValue(new Headers()),
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { AppModule } = require('../src/app.module');

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['api/auth/{*path}'],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health check ──────────────────────────────────────────────────────

  it('/ (GET) — health check returns 200', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  // ─── Public endpoints return a response ────────────────────────────────

  describe('Categories (public)', () => {
    it('GET /api/v1/categories — returns 200', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/categories');
      expect(res.status).toBe(200);
    });
  });

  // ─── Protected endpoints return 401 without session ────────────────────

  describe('RBAC enforcement — unauthenticated requests should be rejected', () => {
    const protectedEndpoints = [
      { method: 'get' as const, path: '/api/v1/users/me' },
      { method: 'get' as const, path: '/api/v1/notifications' },
      { method: 'get' as const, path: '/api/v1/users/me/dashboard' },
    ];

    protectedEndpoints.forEach(({ method, path }) => {
      it(`${method.toUpperCase()} ${path} — returns 401 without session`, async () => {
        const res = await request(app.getHttpServer())[method](path);
        expect(res.status).toBe(401);
      });
    });
  });

  describe('Admin-only endpoints — unauthenticated requests should be rejected', () => {
    const adminEndpoints = [
      { method: 'get' as const, path: '/api/v1/admin/dashboard' },
      { method: 'get' as const, path: '/api/v1/admin/reports/users' },
      { method: 'get' as const, path: '/api/v1/admin/audit-logs' },
      { method: 'get' as const, path: '/api/v1/users' },
    ];

    adminEndpoints.forEach(({ method, path }) => {
      it(`${method.toUpperCase()} ${path} — returns 401`, async () => {
        const res = await request(app.getHttpServer())[method](path);
        expect(res.status).toBe(401);
      });
    });
  });

  describe('POST endpoints — unauthenticated requests should be rejected', () => {
    it('POST /api/v1/categories — returns 401 (admin only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send({ name: 'Test Category' });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/support/tickets — returns 401 (auth required)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .send({ subject: 'Test', body: 'Test body', priority: 'MEDIUM' });
      expect(res.status).toBe(401);
    });
  });
});
