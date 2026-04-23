import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AdminProductImageSchema = z.object({
  key: z.string().trim().min(1).max(2048),
  altText: z.string().trim().max(200).optional(),
  position: z.number().int().min(0).default(0),
});

const VariantAttributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const AdminVariantSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  attributes: z.record(z.string(), VariantAttributeValueSchema),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
});

const AdminCreateProductSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  basePrice: z.number().positive(),
  brand: z.string().trim().min(1).max(100),
  categoryId: z.uuid(),
  isActive: z.boolean().default(true),
  variants: z.array(AdminVariantSchema).min(1),
  images: z.array(AdminProductImageSchema).optional(),
});

export class AdminCreateProductDto extends createZodDto(
  AdminCreateProductSchema,
) {}

const AdminUpdateProductSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional(),
  basePrice: z.number().positive().optional(),
  brand: z.string().trim().min(1).max(100).optional(),
  categoryId: z.uuid().optional(),
  isActive: z.boolean().optional(),
  images: z.array(AdminProductImageSchema).optional(),
  variants: z.array(AdminVariantSchema).min(1),
});

export class AdminUpdateProductDto extends createZodDto(
  AdminUpdateProductSchema,
) {}

const AdminCreateVariantSchema = AdminVariantSchema.extend({
  productId: z.string().uuid(),
});

export class AdminCreateVariantDto extends createZodDto(
  AdminCreateVariantSchema,
) {}

const AdminUpdateVariantSchema = z.object({
  sku: z.string().trim().min(1).max(50).optional(),
  attributes: z.record(z.string(), VariantAttributeValueSchema).optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export class AdminUpdateVariantDto extends createZodDto(
  AdminUpdateVariantSchema,
) {}

const AdminProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  categoryId: z.uuid().optional(),
  isActive: z
    .string()
    .transform((value) => value === 'true')
    .optional(),
  availability: z
    .enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'INACTIVE'])
    .optional(),
  lowStockOnly: z
    .string()
    .transform((value) => value === 'true')
    .optional(),
});

export class AdminProductListQueryDto extends createZodDto(
  AdminProductListQuerySchema,
) {}

const BulkImportProductsSchema = z.object({
  csvContent: z.string().min(1),
});

export class BulkImportProductsDto extends createZodDto(
  BulkImportProductsSchema,
) {}

const UploadUrlQuerySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
});

export class UploadUrlQueryDto extends createZodDto(UploadUrlQuerySchema) {}

const DeleteUploadedImagesSchema = z.object({
  keys: z.array(z.string().trim().min(1).max(2048)).min(1).max(50),
});

export class DeleteUploadedImagesDto extends createZodDto(
  DeleteUploadedImagesSchema,
) {}
