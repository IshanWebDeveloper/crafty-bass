import { describe, it, expect, vi, afterEach } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { IncomingHttpHeaders } from 'node:http';
import { ClassificationService } from './classification.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';

// The service mints a service JWT via @repo/auth and normalises headers via
// better-auth/node - neither needs to do real work in a unit test.
vi.mock('@repo/auth', () => ({
  auth: {
    api: { getToken: vi.fn(() => Promise.resolve({ token: 'jwt-123' })) },
  },
}));
vi.mock('better-auth/node', () => ({
  fromNodeHeaders: (h: IncomingHttpHeaders) => h,
}));

type Category = {
  id: string;
  slug: string;
  nameEn: string;
  description: string | null;
};
type Skill = {
  id: string;
  slug: string;
  nameEn: string;
  category: { slug: string } | null;
};

function makeService(opts: { categories?: Category[]; skills?: Skill[] }) {
  const { categories = [], skills = [] } = opts;
  const prisma = {
    serviceCategory: { findMany: vi.fn(() => Promise.resolve(categories)) },
    skill: { findMany: vi.fn(() => Promise.resolve(skills)) },
  } as unknown as PrismaService;
  const config = {
    get: vi.fn(() => 'http://ai.test'),
  } as unknown as ConfigService;
  return new ClassificationService(config, prisma);
}

const HEADERS = {} as IncomingHttpHeaders;

function aiResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : ''),
  } as unknown as Response;
}

describe('ClassificationService.classifyJob', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('short-circuits with an empty prediction when there are no categories', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = makeService({ categories: [] });

    const result = await service.classifyJob(
      { title: 'x', description: 'y' } as never,
      HEADERS,
    );

    expect(result).toEqual({
      category: null,
      skills: [],
      confidence: 0,
      reasoning: 'No active categories to classify against.',
      model: 'none',
    });
    // No taxonomy means the model is never called.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps the model slugs back onto catalog rows and drops invented ones', async () => {
    const categories: Category[] = [
      { id: 'c1', slug: 'electrical', nameEn: 'Electrical', description: null },
      { id: 'c2', slug: 'plumbing', nameEn: 'Plumbing', description: null },
    ];
    const skills: Skill[] = [
      {
        id: 's1',
        slug: 'wiring',
        nameEn: 'Wiring',
        category: { slug: 'electrical' },
      },
      {
        id: 's2',
        slug: 'sockets',
        nameEn: 'Sockets',
        category: { slug: 'electrical' },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          aiResponse({
            category_slug: 'electrical',
            skill_slugs: ['wiring', 'not-a-real-skill'],
            confidence: 0.95,
            reasoning_summary: 'Mentions rewiring sockets.',
            model: 'openai/gpt-4o-mini',
          }),
        ),
      ),
    );
    const service = makeService({ categories, skills });

    const result = await service.classifyJob(
      { title: 'Rewire kitchen sockets', description: '...' } as never,
      HEADERS,
    );

    expect(result.category).toEqual({
      id: 'c1',
      slug: 'electrical',
      nameEn: 'Electrical',
    });
    // Only the real, suggested skill survives; the invented slug is dropped.
    expect(result.skills).toEqual([
      { id: 's1', slug: 'wiring', nameEn: 'Wiring' },
    ]);
    expect(result.confidence).toBe(0.95);
    expect(result.model).toBe('openai/gpt-4o-mini');
  });

  it('clamps an out-of-range confidence into [0, 1]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          aiResponse({ category_slug: null, confidence: 1.7, model: 'm' }),
        ),
      ),
    );
    const service = makeService({
      categories: [
        {
          id: 'c1',
          slug: 'electrical',
          nameEn: 'Electrical',
          description: null,
        },
      ],
    });

    const result = await service.classifyJob(
      { title: 'x', description: 'y' } as never,
      HEADERS,
    );

    expect(result.confidence).toBe(1);
    expect(result.category).toBeNull();
  });

  it('throws ServiceUnavailable when the AI service returns a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(aiResponse('upstream boom', false, 500))),
    );
    const service = makeService({
      categories: [
        {
          id: 'c1',
          slug: 'electrical',
          nameEn: 'Electrical',
          description: null,
        },
      ],
    });

    await expect(
      service.classifyJob({ title: 'x', description: 'y' } as never, HEADERS),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws ServiceUnavailable when the AI service is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    );
    const service = makeService({
      categories: [
        {
          id: 'c1',
          slug: 'electrical',
          nameEn: 'Electrical',
          description: null,
        },
      ],
    });

    await expect(
      service.classifyJob({ title: 'x', description: 'y' } as never, HEADERS),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
