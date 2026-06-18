import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── Create Category ────────────────────────────────────────────────────────

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().optional(),
});

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}

// ─── Update Category ────────────────────────────────────────────────────────

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.uuid().optional(),
});

export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}

// ─── Category Response ──────────────────────────────────────────────────────

const CategoryResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  parentId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class CategoryResponseDto extends createZodDto(CategoryResponseSchema) {}
