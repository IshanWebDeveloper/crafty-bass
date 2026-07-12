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
  revieweeId: z.string().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export class AdminReviewQueryDto extends createZodDto(AdminReviewQuerySchema) {}

// Moderators can additionally toggle a review's visibility (isPublic) on top of
// the content fields a review's author may edit. Kept separate from the shared
// UpdateReviewSchema so self-edits can never flip visibility.
const AdminModerateReviewSchema = z.object({
  isPublic: z.boolean().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  title: z.string().max(120).nullish(),
  comment: z.string().max(2000).nullish(),
});

export class AdminModerateReviewDto extends createZodDto(
  AdminModerateReviewSchema,
) {}
