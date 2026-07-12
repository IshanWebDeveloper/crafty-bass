import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  HomeownerProfileSchema,
  TradesmanProfileSchema,
} from '@repo/validation';

export class UpsertHomeownerProfileDto extends createZodDto(
  HomeownerProfileSchema,
) {}

export class UpsertTradesmanProfileDto extends createZodDto(
  TradesmanProfileSchema,
) {}

// ─── Public tradesman directory query ───────────────────────────────────────

const BrowseTradesmenSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  district: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  skillId: z.string().trim().min(1).optional(),
});

export class BrowseTradesmenDto extends createZodDto(BrowseTradesmenSchema) {}
