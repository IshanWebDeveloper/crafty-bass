import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CreateReviewSchema, UpdateReviewSchema } from '@repo/validation';

// Re-export shared schemas wrapped as NestJS DTOs
export class CreateReviewDto extends createZodDto(CreateReviewSchema) {}

export class UpdateReviewDto extends createZodDto(UpdateReviewSchema) {}

// ─── Review Query ───────────────────────────────────────────────────────────

const ReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sortBy: z.enum(['rating', 'createdAt', 'updatedAt']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export class ReviewQueryDto extends createZodDto(ReviewQuerySchema) {}

const AdminReviewQuerySchema = ReviewQuerySchema.extend({
  productId: z.string().uuid().optional(),
  userId: z.string().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export class AdminReviewQueryDto extends createZodDto(AdminReviewQuerySchema) {}
