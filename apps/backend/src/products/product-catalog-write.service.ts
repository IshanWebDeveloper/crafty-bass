import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { generateSlug } from '../common/utils/slug.util.js';

type VariantAttributeValue = string | number | boolean | null;

export interface ProductWriteVariantInput {
  sku: string;
  attributes: Record<string, VariantAttributeValue>;
  price: number;
  stock: number;
  lowStockThreshold?: number;
}

export interface ProductWriteImageInput {
  key: string;
  altText?: string;
  position: number;
}

export interface ProductCreateInput {
  name: string;
  description?: string;
  basePrice: number;
  brand: string;
  categoryId: string;
  isActive?: boolean;
  variants: ProductWriteVariantInput[];
  images?: ProductWriteImageInput[];
}

export interface ProductUpdateInput {
  name?: string;
  description?: string;
  basePrice?: number;
  brand?: string;
  categoryId?: string;
  isActive?: boolean;
  images?: ProductWriteImageInput[];
  variants?: ProductWriteVariantInput[];
}

@Injectable()
export class ProductCatalogWriteService {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  private normalizeSku(sku: string) {
    return sku.trim().toUpperCase();
  }

  private normalizeImageKey(key: string) {
    return key.trim().replace(/^\/+/, '');
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

  private async ensureUniqueProductSlug(
    slug: string,
    excludedProductId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const existing = await this.getClient(tx).product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing && existing.id !== excludedProductId) {
      throw new ConflictException('Product with this name already exists');
    }
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

  private mapImages(images: ProductWriteImageInput[] | undefined) {
    return images?.map((image) => ({
      url: this.normalizeImageKey(image.key),
      altText: image.altText,
      position: image.position,
    }));
  }

  async createProduct(input: ProductCreateInput) {
    const slug = generateSlug(input.name);
    await this.ensureCategoryExists(input.categoryId);
    await this.ensureUniqueProductSlug(slug);

    const normalizedSkus = input.variants.map((variant) =>
      this.normalizeSku(variant.sku),
    );

    if (new Set(normalizedSkus).size !== normalizedSkus.length) {
      throw new BadRequestException('Duplicate variant SKUs found in request');
    }

    for (const sku of normalizedSkus) {
      await this.ensureUniqueVariantSku(sku);
    }

    return this.prisma.product.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        basePrice: input.basePrice,
        brand: input.brand,
        categoryId: input.categoryId,
        isActive: input.isActive ?? true,
        variants: {
          create: input.variants.map((variant) => ({
            sku: this.normalizeSku(variant.sku),
            attributes: variant.attributes as Prisma.InputJsonValue,
            price: variant.price,
            stock: variant.stock,
            lowStockThreshold: variant.lowStockThreshold ?? 5,
          })),
        },
        images: input.images
          ? {
              create: this.mapImages(input.images),
            }
          : undefined,
      },
      include: { variants: true, images: true },
    });
  }

  async updateProduct(id: string, input: ProductUpdateInput) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const data: Prisma.ProductUpdateInput = {};

    if (input.name !== undefined) {
      const slug = generateSlug(input.name);
      await this.ensureUniqueProductSlug(slug, id);
      data.name = input.name;
      data.slug = slug;
    }

    if (input.description !== undefined) data.description = input.description;
    if (input.basePrice !== undefined) data.basePrice = input.basePrice;
    if (input.brand !== undefined) data.brand = input.brand;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (input.categoryId !== undefined) {
      await this.ensureCategoryExists(input.categoryId);
      data.category = { connect: { id: input.categoryId } };
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data });

      if (input.images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (input.images.length > 0) {
          await tx.productImage.createMany({
            data: input.images.map((image) => ({
              productId: id,
              url: this.normalizeImageKey(image.key),
              altText: image.altText,
              position: image.position,
            })),
          });
        }
      }

      if (input.variants !== undefined) {
        const existingVariants = await tx.productVariant.findMany({
          where: { productId: id },
          select: { id: true, sku: true },
        });

        // Upsert input variants
        for (const variant of input.variants) {
          const normalizedSku = this.normalizeSku(variant.sku);
          const existingVariant = existingVariants.find(
            (v) => v.sku === normalizedSku,
          );

          if (existingVariant) {
            await this.ensureUniqueVariantSku(
              normalizedSku,
              existingVariant.id,
              tx,
            );
            await tx.productVariant.update({
              where: { id: existingVariant.id },
              data: {
                attributes: variant.attributes as Prisma.InputJsonValue,
                price: variant.price,
                stock: variant.stock,
                lowStockThreshold: variant.lowStockThreshold ?? 5,
              },
            });
          } else {
            await this.ensureUniqueVariantSku(normalizedSku, undefined, tx);
            await tx.productVariant.create({
              data: {
                productId: id,
                sku: normalizedSku,
                attributes: variant.attributes as Prisma.InputJsonValue,
                price: variant.price,
                stock: variant.stock,
                lowStockThreshold: variant.lowStockThreshold ?? 5,
              },
            });
          }
        }
      }

      return tx.product.findUniqueOrThrow({
        where: { id },
        include: { variants: true, images: true },
      });
    });
  }

  async updateVariantStock(variantId: string, stock: number) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: { stock },
    });
  }

  async softDeleteProduct(id: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: { variants: true, images: true },
    });

    return {
      previousIsActive: existing.isActive,
      product,
    };
  }
}
