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
// UpdateReviewSchema so self-edits can never flip visibility. A `reason` is
// required when hiding a review (isPublic:false) so the author is told why; it
// is optional for pure content edits that keep the review public.
const AdminModerateReviewSchema = z
  .object({
    isPublic: z.boolean().optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    title: z.string().max(120).nullish(),
    comment: z.string().max(2000).nullish(),
    reason: z.string().trim().min(3).max(1000).optional(),
  })
  .refine((v) => v.isPublic !== false || (v.reason?.trim().length ?? 0) >= 3, {
    message: 'A reason is required when hiding a review',
    path: ['reason'],
  });

export class AdminModerateReviewDto extends createZodDto(
  AdminModerateReviewSchema,
) {}

// Deleting a review is destructive and always requires a reason (surfaced to the
// author before the row is removed). Sent as a request body on the DELETE route.
const AdminDeleteReviewSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export class AdminDeleteReviewDto extends createZodDto(
  AdminDeleteReviewSchema,
) {}
