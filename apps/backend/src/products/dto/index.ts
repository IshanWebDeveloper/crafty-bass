import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── Product Variant ────────────────────────────────────────────────────────

const ProductVariantSchema = z.object({
  sku: z.string().min(1).max(50),
  attributes: z.record(z.string(), z.string()),
  price: z.number().positive(),
  stock: z.number().int().min(0),
});

// ─── Product Image ──────────────────────────────────────────────────────────

const ProductImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().max(200).optional(),
  position: z.number().int().min(0).default(0),
});

// ─── Create Product ─────────────────────────────────────────────────────────

const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  basePrice: z.number().positive(),
  brand: z.string().min(1).max(100),
  categoryId: z.string().uuid(),
  variants: z.array(ProductVariantSchema).min(1),
  images: z.array(ProductImageSchema).optional(),
});

export class CreateProductDto extends createZodDto(CreateProductSchema) {}

// ─── Update Product ─────────────────────────────────────────────────────────

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  basePrice: z.number().positive().optional(),
  brand: z.string().min(1).max(100).optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}

// ─── Update Stock ───────────────────────────────────────────────────────────

const UpdateStockSchema = z.object({
  stock: z.number().int().min(0),
});

export class UpdateStockDto extends createZodDto(UpdateStockSchema) {}

// ─── Product Query (Browse / Filter / Search) ───────────────────────────────

const ProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'basePrice', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export class ProductQueryDto extends createZodDto(ProductQuerySchema) {}

// ─── Product Search Query (Autocomplete) ───────────────────────────────────

const ProductSearchQuerySchema = z.object({
  q: z.coerce.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export class ProductSearchQueryDto extends createZodDto(
  ProductSearchQuerySchema,
) {}

// ─── Compare Query ──────────────────────────────────────────────────────────

const CompareQuerySchema = z.object({
  ids: z
    .string()
    .transform((v) => v.split(','))
    .refine((arr) => arr.length >= 2 && arr.length <= 4, {
      message: 'Compare 2 to 4 products',
    }),
});

export class CompareQueryDto extends createZodDto(CompareQuerySchema) {}
