import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';

import { mintAiServiceToken } from '@repo/auth';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { ClassifyJobDto, ClassifyJobResponseDto } from './dto/index.js';

// Shape the AI service returns from POST /api/v1/assistant/classify-job.
interface AiClassificationResponse {
  category_slug?: string | null;
  skill_slugs?: string[];
  confidence?: number;
  reasoning_summary?: string;
  model?: string;
}

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.aiServiceUrl =
      this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8006';
  }

  async classifyJob(
    dto: ClassifyJobDto,
    headers: IncomingHttpHeaders,
  ): Promise<ClassifyJobResponseDto> {
    // The taxonomy the model chooses from is the live catalog, not a hardcoded
    // list - so new categories/skills are classifiable the moment they're seeded.
    const [categories, skills] = await Promise.all([
      this.prisma.serviceCategory.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, nameEn: true, description: true },
        orderBy: { nameEn: 'asc' },
      }),
      this.prisma.skill.findMany({
        select: {
          id: true,
          slug: true,
          nameEn: true,
          category: { select: { slug: true } },
        },
        orderBy: { nameEn: 'asc' },
      }),
    ]);

    // Nothing to classify against - return an empty prediction rather than
    // calling the model with an empty taxonomy (which it would reject).
    if (categories.length === 0) {
      return {
        category: null,
        skills: [],
        confidence: 0,
        reasoning: 'No active categories to classify against.',
        model: 'none',
      };
    }

    // Mint a short-lived, server-only JWT for the signed-in user so the AI service can
    // verify the call via the better-auth JWKS - the AI service is never
    // exposed to the browser directly. Mirrors TranslationService.
    const token = await this.getServiceToken(headers);

    let response: Response;
    try {
      response = await fetch(
        `${this.aiServiceUrl}/api/v1/assistant/classify-job`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: dto.title,
            description: dto.description,
            language: dto.language,
            categories: categories.map((c) => ({
              slug: c.slug,
              name: c.nameEn,
              description: c.description ?? undefined,
            })),
            skills: skills.length
              ? skills.map((s) => ({
                  slug: s.slug,
                  name: s.nameEn,
                  category_slug: s.category?.slug ?? undefined,
                }))
              : undefined,
          }),
        },
      );
    } catch (err) {
      this.logger.error(
        `AI service unreachable at ${this.aiServiceUrl}: ${String(err)}`,
      );
      throw new ServiceUnavailableException(
        'Classification service unavailable',
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(
        `AI classify failed (${response.status}): ${detail.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException('Classification failed');
    }

    const data = (await response.json()) as AiClassificationResponse;

    // Map the model's slugs back onto real catalog rows. A slug the model
    // invented (not in the catalog) simply resolves to nothing and is dropped.
    const category =
      data.category_slug != null
        ? (categories.find((c) => c.slug === data.category_slug) ?? null)
        : null;

    const suggestedSlugs = new Set(data.skill_slugs ?? []);
    const matchedSkills = skills.filter((s) => suggestedSlugs.has(s.slug));

    return {
      category: category
        ? { id: category.id, slug: category.slug, nameEn: category.nameEn }
        : null,
      skills: matchedSkills.map((s) => ({
        id: s.id,
        slug: s.slug,
        nameEn: s.nameEn,
      })),
      confidence: clampConfidence(data.confidence),
      reasoning: data.reasoning_summary ?? '',
      model: data.model ?? 'unknown',
    };
  }

  private async getServiceToken(headers: IncomingHttpHeaders): Promise<string> {
    const token = await mintAiServiceToken(fromNodeHeaders(headers));
    if (!token) {
      throw new ServiceUnavailableException(
        'Could not authorize classification',
      );
    }
    return token;
  }
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
