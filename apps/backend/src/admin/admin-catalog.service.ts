import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { generateSlug } from '../common/utils/slug.util.js';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../categories/dto/index.js';
import { AdminService } from './admin.service.js';
import { S3Service } from './s3.service.js';
import type {
  AdminCreateProductDto,
  AdminCreateVariantDto,
  AdminProductListQueryDto,
  AdminUpdateProductDto,
  AdminUpdateVariantDto,
  BulkImportProductsDto,
} from './dto/catalog.dto.js';
import { ProductCatalogWriteService } from '../products/product-catalog-write.service.js';

type AdminProduct = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true } };
    images: { orderBy: { position: 'asc' } };
    variants: { orderBy: { createdAt: 'asc' } };
  };
}>;

const emptyStringToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

const csvRowSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().optional(),
    ),
    brand: z.string().trim().min(1),
    basePrice: z.coerce.number().positive(),
    categoryId: z.preprocess(
      emptyStringToUndefined,
      z.string().uuid().optional(),
    ),
    categorySlug: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(1).optional(),
    ),
    sku: z.string().trim().min(1),
    price: z.coerce.number().positive(),
    stock: z.coerce.number().int().min(0),
    lowStockThreshold: z.preprocess(
      emptyStringToUndefined,
      z.coerce.number().int().min(0).optional(),
    ),
    imageKeys: z.preprocess(emptyStringToUndefined, z.string().optional()),
    attributes: z.preprocess(emptyStringToUndefined, z.string().optional()),
    isActive: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .transform((value) =>
          ['true', '1', 'yes'].includes(value.toLowerCase()),
        )
        .optional(),
    ),
  })
  .superRefine((row, ctx) => {
    if (!row.categoryId && !row.categorySlug) {
      ctx.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: 'Either categoryId or categorySlug is required',
      });
    }
  });

type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly adminService: AdminService,
    private readonly productCatalogWriteService: ProductCatalogWriteService,
  ) {}

  private readonly productInclude = {
    category: { select: { id: true, name: true, slug: true } },
    images: { orderBy: { position: 'asc' as const } },
    variants: { orderBy: { createdAt: 'asc' as const } },
  };

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  private normalizeSku(sku: string) {
    return sku.trim().toUpperCase();
  }

  private sanitizeFilename(filename: string) {
    return filename
      .trim()
      .replace(/[^\w.\\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120);
  }

  private serializeVariant(variant: AdminProduct['variants'][number]) {
    const isOutOfStock = variant.stock <= 0;
    const isLowStock =
      !isOutOfStock && variant.stock <= variant.lowStockThreshold;

    return {
      ...variant,
      price: Number(variant.price),
      availabilityStatus: isOutOfStock
        ? 'OUT_OF_STOCK'
        : isLowStock
          ? 'LOW_STOCK'
          : 'IN_STOCK',
      isLowStock,
      isOutOfStock,
    };
  }

  private async serializeProduct(product: AdminProduct) {
    const variants = product.variants.map((variant) =>
      this.serializeVariant(variant),
    );
    const totalStock = variants.reduce(
      (sum, variant) => sum + variant.stock,
      0,
    );
    const lowStockVariants = variants.filter(
      (variant) => variant.isLowStock,
    ).length;
    const outOfStockVariants = variants.filter(
      (variant) => variant.isOutOfStock,
    ).length;

    return {
      ...product,
      basePrice: Number(product.basePrice),
      images: await Promise.all(
        product.images.map(async (image) => ({
          id: image.id,
          key: image.url,
          url: await this.s3Service.getPresignedDownloadUrl(image.url),
          altText: image.altText,
          position: image.position,
        })),
      ),
      variants,
      inventory: {
        variantCount: variants.length,
        totalStock,
        lowStockVariants,
        outOfStockVariants,
        availabilityStatus: !product.isActive
          ? 'INACTIVE'
          : totalStock === 0
            ? 'OUT_OF_STOCK'
            : lowStockVariants > 0
              ? 'LOW_STOCK'
              : 'IN_STOCK',
      },
    };
  }

  private async ensureCategoryExists(
    categoryId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const category = await this.getClient(tx).category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private async resolveCategoryId(categoryId?: string, categorySlug?: string) {
    if (categoryId) {
      await this.ensureCategoryExists(categoryId);
      return categoryId;
    }

    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category.id;
  }

  private async ensureUniqueVariantSku(
    sku: string,
    excludedVariantId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const existing = await this.getClient(tx).productVariant.findUnique({
      where: { sku },
      select: { id: true },
    });

    if (existing && existing.id !== excludedVariantId) {
      throw new ConflictException(`Variant SKU ${sku} already exists`);
    }
  }

  async getUploadUrl(filename: string, contentType: string) {
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new BadRequestException('Only image uploads are supported');
    }

    const sanitizedFilename = this.sanitizeFilename(filename);
    if (!sanitizedFilename) {
      throw new BadRequestException('Filename is invalid');
    }

    const key = `products/${Date.now()}-${sanitizedFilename}`;
    return {
      key,
      presignedUrl: await this.s3Service.getPresignedUploadUrl(
        key,
        contentType,
        60,
      ),
      expiresIn: 60,
    };
  }

  async uploadImage(file: UploadedImageFile) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (!file.mimetype.toLowerCase().startsWith('image/')) {
      throw new BadRequestException('Only image uploads are supported');
    }

    const maxImageSizeInBytes = 10 * 1024 * 1024;
    if (file.size > maxImageSizeInBytes) {
      throw new BadRequestException('Image size must be 10MB or smaller');
    }

    const sanitizedFilename = this.sanitizeFilename(file.originalname);
    if (!sanitizedFilename) {
      throw new BadRequestException('Filename is invalid');
    }

    const key = `products/${Date.now()}-${sanitizedFilename}`;
    await this.s3Service.uploadObject(key, file.buffer, file.mimetype);

    return {
      key,
      url: await this.s3Service.getPresignedDownloadUrl(key),
    };
  }

  async cleanupUploadedImages(keys: string[]) {
    const normalizedKeys = [...new Set(keys.map((key) => key.trim()))].filter(
      (key) => key.length > 0,
    );

    if (normalizedKeys.length === 0) {
      throw new BadRequestException('At least one image key is required');
    }

    const invalidKey = normalizedKeys.find(
      (key) => !key.startsWith('products/'),
    );
    if (invalidKey) {
      throw new BadRequestException('Only product image keys can be deleted');
    }

    await Promise.all(
      normalizedKeys.map((key) => this.s3Service.deleteObject(key)),
    );

    return { deletedKeys: normalizedKeys };
  }

  async listProducts(query: AdminProductListQueryDto) {
    const products = await this.prisma.product.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { slug: { contains: query.search, mode: 'insensitive' } },
                { brand: { contains: query.search, mode: 'insensitive' } },
                {
                  description: { contains: query.search, mode: 'insensitive' },
                },
              ],
            }
          : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      include: this.productInclude,
      orderBy: { updatedAt: 'desc' },
    });

    const serialized = await Promise.all(
      products.map((product) => this.serializeProduct(product)),
    );
    const filtered = serialized.filter((product) => {
      if (
        query.availability &&
        product.inventory.availabilityStatus !== query.availability
      ) {
        return false;
      }

      if (
        query.lowStockOnly === true &&
        product.inventory.lowStockVariants === 0
      ) {
        return false;
      }

      return true;
    });

    const start = (query.page - 1) * query.limit;
    return {
      data: filtered.slice(start, start + query.limit),
      meta: buildPaginationMeta(filtered.length, query.page, query.limit),
    };
  }

  async findProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.productInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.serializeProduct(product);
  }

  async createProduct(dto: AdminCreateProductDto, actorId: string) {
    const product = await this.productCatalogWriteService.createProduct({
      name: dto.name,
      description: dto.description,
      basePrice: dto.basePrice,
      brand: dto.brand,
      categoryId: dto.categoryId,
      isActive: dto.isActive,
      variants: dto.variants.map((variant) => ({
        sku: variant.sku,
        attributes: variant.attributes,
        price: variant.price,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
      })),
      images: dto.images?.map((image) => ({
        key: image.key,
        altText: image.altText,
        position: image.position,
      })),
    });

    const hydratedProduct = await this.prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: this.productInclude,
    });

    await this.adminService.log(
      actorId,
      'PRODUCT_CREATE',
      'product',
      product.id,
      {
        name: hydratedProduct.name,
        variantCount: hydratedProduct.variants.length,
        imageCount: hydratedProduct.images.length,
      },
    );

    return this.serializeProduct(hydratedProduct);
  }

  async updateProduct(id: string, dto: AdminUpdateProductDto, actorId: string) {
    const product = await this.productCatalogWriteService.updateProduct(id, {
      name: dto.name,
      description: dto.description,
      basePrice: dto.basePrice,
      brand: dto.brand,
      categoryId: dto.categoryId,
      isActive: dto.isActive,
      images: dto.images?.map((image) => ({
        key: image.key,
        altText: image.altText,
        position: image.position,
      })),
      variants: dto.variants.map((variant) => ({
        sku: variant.sku,
        attributes: variant.attributes,
        price: variant.price,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
      })),
    });

    const hydratedProduct = await this.prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: this.productInclude,
    });

    await this.adminService.log(actorId, 'PRODUCT_UPDATE', 'product', id, dto);
    return this.serializeProduct(hydratedProduct);
  }

  async deleteProduct(id: string, actorId: string) {
    const result = await this.productCatalogWriteService.softDeleteProduct(id);

    const hydratedProduct = await this.prisma.product.findUniqueOrThrow({
      where: { id: result.product.id },
      include: this.productInclude,
    });

    await this.adminService.log(actorId, 'PRODUCT_DELETE', 'product', id, {
      previousIsActive: result.previousIsActive,
      nextIsActive: false,
    });

    return this.serializeProduct(hydratedProduct);
  }

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    const buildTree = (parentId: string | null): unknown[] =>
      categories
        .filter((category) => category.parentId === parentId)
        .map((category) => ({
          ...category,
          children: buildTree(category.id),
        }));

    return buildTree(null);
  }

  async createCategory(dto: CreateCategoryDto, actorId: string) {
    const slug = generateSlug(dto.name);
    const existing = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }
    if (dto.parentId) {
      await this.ensureCategoryExists(dto.parentId);
    }

    const category = await this.prisma.category.create({
      data: { name: dto.name, slug, parentId: dto.parentId ?? null },
    });
    await this.adminService.log(
      actorId,
      'CATEGORY_CREATE',
      'category',
      category.id,
      dto,
    );
    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, actorId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) {
      const slug = generateSlug(dto.name);
      const existing = await this.prisma.category.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Category with this name already exists');
      }
      data.name = dto.name;
      data.slug = slug;
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new ConflictException('Category cannot be its own parent');
      }
      if (dto.parentId) {
        await this.ensureCategoryExists(dto.parentId);
      }

      await this.prisma.category.updateMany({
        where: { parentId: id },
        data: { parentId: dto.parentId ?? null },
      });
    }

    const updated = await this.prisma.category.update({ where: { id }, data });
    await this.adminService.log(
      actorId,
      'CATEGORY_UPDATE',
      'category',
      id,
      dto,
    );
    return updated;
  }

  async deleteCategory(id: string, actorId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (category._count.children > 0) {
      throw new ConflictException(
        'Cannot delete category with child categories',
      );
    }
    if (category._count.products > 0) {
      throw new ConflictException('Cannot delete category with products');
    }

    const deleted = await this.prisma.category.delete({ where: { id } });
    await this.adminService.log(actorId, 'CATEGORY_DELETE', 'category', id, {
      name: deleted.name,
    });
    return deleted;
  }

  async createVariant(dto: AdminCreateVariantDto, actorId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const sku = this.normalizeSku(dto.sku);
    await this.ensureUniqueVariantSku(sku);

    const variant = await this.prisma.productVariant.create({
      data: {
        productId: dto.productId,
        sku,
        attributes: dto.attributes as Prisma.InputJsonValue,
        price: dto.price,
        stock: dto.stock,
        lowStockThreshold: dto.lowStockThreshold,
      },
    });

    await this.adminService.log(
      actorId,
      'VARIANT_CREATE',
      'product_variant',
      variant.id,
      {
        productId: dto.productId,
        sku,
      },
    );

    return this.serializeVariant(variant);
  }

  async updateVariant(id: string, dto: AdminUpdateVariantDto, actorId: string) {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Variant not found');
    }

    const data: Prisma.ProductVariantUpdateInput = {};
    if (dto.sku !== undefined) {
      const sku = this.normalizeSku(dto.sku);
      await this.ensureUniqueVariantSku(sku, id);
      data.sku = sku;
    }
    if (dto.attributes !== undefined) {
      data.attributes = dto.attributes as Prisma.InputJsonValue;
    }
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.lowStockThreshold !== undefined) {
      data.lowStockThreshold = dto.lowStockThreshold;
    }

    const variant = await this.prisma.productVariant.update({
      where: { id },
      data,
    });
    await this.adminService.log(
      actorId,
      'VARIANT_UPDATE',
      'product_variant',
      id,
      dto,
    );
    return this.serializeVariant(variant);
  }

  async deleteVariant(id: string, actorId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { _count: { select: { cartItems: true, orderItems: true } } },
    });
    if (!variant) {
      throw new NotFoundException('Variant not found');
    }
    if (variant._count.cartItems > 0 || variant._count.orderItems > 0) {
      throw new BadRequestException(
        'Cannot delete variant that is already referenced by carts or orders',
      );
    }

    const deleted = await this.prisma.productVariant.delete({ where: { id } });
    await this.adminService.log(
      actorId,
      'VARIANT_DELETE',
      'product_variant',
      id,
      {
        sku: deleted.sku,
      },
    );
    return deleted;
  }

  async bulkImportProducts(dto: BulkImportProductsDto, actorId: string) {
    const rows = parse(dto.csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const errors: Array<{ row: number; field: string; message: string }> = [];
    let success = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const parsed = csvRowSchema.safeParse(row);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({
            row: rowNumber,
            field: issue.path.join('.') || 'row',
            message: issue.message,
          });
        }
        continue;
      }
      type VariantAttributeValue = string | number | boolean | null;
      let attributes: Record<string, VariantAttributeValue> = {};
      if (parsed.data.attributes) {
        try {
          const parsedAttributes: unknown = JSON.parse(parsed.data.attributes);
          if (
            !parsedAttributes ||
            typeof parsedAttributes !== 'object' ||
            Array.isArray(parsedAttributes)
          ) {
            throw new Error('attributes must be a JSON object');
          }
          attributes = parsedAttributes as Record<
            string,
            VariantAttributeValue
          >;
        } catch (error) {
          errors.push({
            row: rowNumber,
            field: 'attributes',
            message:
              error instanceof Error
                ? error.message
                : 'attributes must be valid JSON',
          });
          continue;
        }
      }

      try {
        const categoryId = await this.resolveCategoryId(
          parsed.data.categoryId,
          parsed.data.categorySlug,
        );

        await this.createProduct(
          {
            name: parsed.data.name,
            description: parsed.data.description,
            basePrice: parsed.data.basePrice,
            brand: parsed.data.brand,
            categoryId,
            isActive: parsed.data.isActive ?? true,
            images: parsed.data.imageKeys
              ? parsed.data.imageKeys
                  .split('|')
                  .map((key, position) => ({ key: key.trim(), position }))
                  .filter((image) => image.key.length > 0)
              : undefined,
            variants: [
              {
                sku: parsed.data.sku,
                attributes,
                price: parsed.data.price,
                stock: parsed.data.stock,
                lowStockThreshold: parsed.data.lowStockThreshold ?? 5,
              },
            ],
          },
          actorId,
        );

        success += 1;
      } catch (error) {
        errors.push({
          row: rowNumber,
          field: 'row',
          message:
            error instanceof Error ? error.message : 'Failed to import row',
        });
      }
    }

    await this.adminService.log(
      actorId,
      'PRODUCT_BULK_IMPORT',
      'product',
      'bulk-import',
      {
        success,
        errorCount: errors.length,
      },
    );

    return { success, errors };
  }
}
