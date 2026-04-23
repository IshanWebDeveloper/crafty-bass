import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { S3Service } from '../admin/s3.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import type {
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  ProductQueryDto,
} from './dto/index.js';
import { ProductCatalogWriteService } from './product-catalog-write.service.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly productCatalogWriteService: ProductCatalogWriteService,
  ) {}

  private sanitizeSearchQuery(query: string): string {
    return query
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async createSearchAuditLog(
    userId: string | undefined,
    query: string,
    resultCount: number,
  ) {
    if (!userId) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PRODUCT_SEARCH',
        entity: 'product',
        entityId: 'search',
        details: {
          query,
          resultCount,
        },
      },
    });
  }

  private readonly productListInclude = {
    category: { select: { id: true, name: true, slug: true } },
    images: { take: 1, orderBy: { position: 'asc' as const } },
    variants: { select: { id: true, price: true, stock: true } },
    _count: { select: { reviews: true } },
  };

  private async attachSignedImageUrls<
    T extends { images: Array<{ url: string }> },
  >(product: T): Promise<T> {
    const images = await Promise.all(
      product.images.map(async (image) => ({
        ...image,
        url: await this.s3Service.getPresignedDownloadUrl(image.url),
      })),
    );

    return {
      ...product,
      images,
    } as T;
  }

  private async attachSignedImageUrlsToMany<
    T extends { images: Array<{ url: string }> },
  >(products: T[]): Promise<T[]> {
    return Promise.all(
      products.map((product) => this.attachSignedImageUrls(product)),
    );
  }

  private buildProductWhere(query: ProductQueryDto): Prisma.ProductWhereInput {
    const { search, categoryId, brand, minPrice, maxPrice, inStock } = query;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (brand) {
      where.brand = { contains: brand, mode: 'insensitive' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
    }

    if (inStock === true) {
      where.variants = { some: { stock: { gt: 0 } } };
    }

    if (inStock === false) {
      where.NOT = {
        variants: { some: { stock: { gt: 0 } } },
      };
    }

    return where;
  }

  private buildFtsFilters(
    query: Pick<
      ProductQueryDto,
      'categoryId' | 'brand' | 'minPrice' | 'maxPrice' | 'inStock'
    >,
  ): Prisma.Sql[] {
    const { categoryId, brand, minPrice, maxPrice, inStock } = query;
    const filters: Prisma.Sql[] = [Prisma.sql`p."isActive" = true`];

    if (categoryId) {
      filters.push(Prisma.sql`p."categoryId" = ${categoryId}`);
    }

    if (brand) {
      filters.push(Prisma.sql`p."brand" ILIKE ${`%${brand}%`}`);
    }

    if (minPrice !== undefined) {
      filters.push(Prisma.sql`p."basePrice" >= ${minPrice}`);
    }

    if (maxPrice !== undefined) {
      filters.push(Prisma.sql`p."basePrice" <= ${maxPrice}`);
    }

    if (inStock === true) {
      filters.push(
        Prisma.sql`EXISTS (
          SELECT 1
          FROM "product_variant" pv
          WHERE pv."productId" = p."id" AND pv."stock" > 0
        )`,
      );
    }

    if (inStock === false) {
      filters.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1
          FROM "product_variant" pv
          WHERE pv."productId" = p."id" AND pv."stock" > 0
        )`,
      );
    }

    return filters;
  }

  private async findAllWithFtsFallback(query: ProductQueryDto) {
    const { page, limit, sortBy, order, search } = query;
    const searchTerm = search?.trim();
    if (!searchTerm) {
      return null;
    }

    const skip = (page - 1) * limit;
    const tsQuery = Prisma.sql`plainto_tsquery('simple', ${searchTerm})`;
    const filters = this.buildFtsFilters(query);
    filters.push(Prisma.sql`p."search_vector" @@ ${tsQuery}`);

    const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`;

    const sortByColumn: Record<ProductQueryDto['sortBy'], Prisma.Sql> = {
      createdAt: Prisma.sql`p."createdAt"`,
      basePrice: Prisma.sql`p."basePrice"`,
      name: Prisma.sql`p."name"`,
    };

    const direction = order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const rankedRows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT p."id"
        FROM "product" p
        ${whereSql}
        ORDER BY ts_rank_cd(p."search_vector", ${tsQuery}) DESC, ${sortByColumn[sortBy]} ${direction}
        LIMIT ${limit}
        OFFSET ${skip}
      `,
    );

    const [{ total }] = await this.prisma.$queryRaw<Array<{ total: number }>>(
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "product" p
        ${whereSql}
      `,
    );

    if (rankedRows.length === 0) {
      return {
        data: [],
        meta: buildPaginationMeta(total ?? 0, page, limit),
      };
    }

    const ids = rankedRows.map((row) => row.id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: this.productListInclude,
    });

    const orderById = new Map(ids.map((id, index) => [id, index]));
    products.sort(
      (a, b) =>
        (orderById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderById.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );

    const productsWithSignedImages =
      await this.attachSignedImageUrlsToMany(products);

    return {
      data: productsWithSignedImages,
      meta: buildPaginationMeta(total ?? 0, page, limit),
    };
  }

  async findAll(query: ProductQueryDto) {
    const { page, limit, sortBy, order } = query;
    const skip = (page - 1) * limit;
    const where = this.buildProductWhere(query);

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: this.productListInclude,
      }),
      this.prisma.product.count({ where }),
    ]);

    if (query.search?.trim() && total === 0) {
      const fallback = await this.findAllWithFtsFallback(query);
      if (fallback) {
        return fallback;
      }
    }

    const productsWithSignedImages =
      await this.attachSignedImageUrlsToMany(products);

    return {
      data: productsWithSignedImages,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async searchSuggestions(query: string, limit = 8, userId?: string) {
    const sanitized = this.sanitizeSearchQuery(query);
    if (sanitized.length < 2) {
      return [];
    }

    const result = await this.findAll({
      page: 1,
      limit,
      sortBy: 'createdAt',
      order: 'desc',
      search: sanitized,
      categoryId: undefined,
      brand: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      inStock: undefined,
    });

    const suggestions = result.data.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      description: product.description,
      imageUrl: product.images[0]?.url,
    }));

    await this.createSearchAuditLog(userId, sanitized, suggestions.length);

    return suggestions;
  }

  async getBrands(): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { isActive: true },
      distinct: ['brand'],
      select: { brand: true },
      orderBy: { brand: 'asc' },
    });

    const seen = new Set<string>();
    const brands: string[] = [];

    for (const row of rows) {
      const trimmed = row.brand.trim();
      if (!trimmed) {
        continue;
      }

      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      brands.push(trimmed);
    }

    return brands;
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        images: { orderBy: { position: 'asc' } },
        variants: true,
        reviews: {
          take: 5,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          include: { user: { select: { id: true, name: true } } },
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    // Calculate average rating
    const avgResult = await this.prisma.review.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
    });
    const productWithSignedImages = await this.attachSignedImageUrls(product);

    return {
      ...productWithSignedImages,
      averageRating: avgResult._avg.rating ?? 0,
    };
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { position: 'asc' } },
        variants: true,
        reviews: {
          take: 5,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          include: { user: { select: { id: true, name: true } } },
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    // Calculate average rating
    const avgResult = await this.prisma.review.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
    });

    const productWithSignedImages = await this.attachSignedImageUrls(product);

    return {
      ...productWithSignedImages,
      averageRating: avgResult._avg.rating ?? 0,
    };
  }

  async compare(ids: string[]) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      include: {
        category: { select: { name: true } },
        variants: true,
        images: { take: 1, orderBy: { position: 'asc' } },
      },
    });

    if (products.length < 2) {
      throw new BadRequestException(
        'Need at least 2 valid products to compare',
      );
    }

    return this.attachSignedImageUrlsToMany(products);
  }

  async create(dto: CreateProductDto) {
    const product = await this.productCatalogWriteService.createProduct({
      name: dto.name,
      description: dto.description,
      basePrice: dto.basePrice,
      brand: dto.brand,
      categoryId: dto.categoryId,
      variants: dto.variants.map((variant) => ({
        sku: variant.sku,
        attributes: variant.attributes,
        price: variant.price,
        stock: variant.stock,
      })),
      images: dto.images?.map((image) => ({
        key: image.url,
        altText: image.altText,
        position: image.position,
      })),
    });

    return this.attachSignedImageUrls(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    const updatedProduct = await this.productCatalogWriteService.updateProduct(
      id,
      {
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice,
        brand: dto.brand,
        categoryId: dto.categoryId,
        isActive: dto.isActive,
      },
    );

    return this.attachSignedImageUrls(updatedProduct);
  }

  async updateStock(variantId: string, dto: UpdateStockDto) {
    return this.productCatalogWriteService.updateVariantStock(
      variantId,
      dto.stock,
    );
  }

  async softDelete(id: string) {
    const { product } =
      await this.productCatalogWriteService.softDeleteProduct(id);

    return this.attachSignedImageUrls(product);
  }
}
