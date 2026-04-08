import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── Pagination Query ───────────────────────────────────────────────────────

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export class PaginationQueryDto extends createZodDto(PaginationQuerySchema) {}

// ─── Pagination Meta ────────────────────────────────────────────────────────

const PaginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  lastPage: z.number(),
});

export class PaginationMetaDto extends createZodDto(PaginationMetaSchema) {}

// ─── API Response Wrapper ───────────────────────────────────────────────────

const ApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export class ApiResponseDto extends createZodDto(ApiResponseSchema) {}

// ─── Helper Function ────────────────────────────────────────────────────────

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
) {
  return {
    total,
    page,
    limit,
    lastPage: Math.ceil(total / limit),
  };
}
