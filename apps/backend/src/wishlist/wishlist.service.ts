import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@repo/db';
import { S3Service } from '../admin/s3.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly s3Service: S3Service,
  ) {}

  private async attachSignedImageUrlsToWishlist<
    T extends {
      items: Array<{
        product?: {
          images: Array<{ url: string }>;
        } | null;
      }>;
    },
  >(wishlist: T): Promise<T> {
    const items = await Promise.all(
      wishlist.items.map(async (item) => {
        if (!item.product) {
          return item;
        }

        const images = await Promise.all(
          item.product.images.map(async (image) => ({
            ...image,
            url: await this.s3Service.getPresignedDownloadUrl(image.url),
          })),
        );

        return {
          ...item,
          product: {
            ...item.product,
            images,
          },
        };
      }),
    );

    return {
      ...wishlist,
      items,
    };
  }

  private toMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private resolveCurrentPrice(input: {
    basePrice: Prisma.Decimal;
    variants: Array<{ price: Prisma.Decimal }>;
  }): number {
    const variantPrice = input.variants[0]?.price;
    const source = variantPrice ?? input.basePrice;
    return this.toMoney(Number(source));
  }

  private async getOrCreateWishlist(userId: string) {
    let wishlist = await this.prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({ data: { userId } });
    }
    return wishlist;
  }

  async getWishlist(userId: string) {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                basePrice: true,
                brand: true,
                images: { take: 1, orderBy: { position: 'asc' } },
                variants: { select: { stock: true }, take: 1 },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wishlist) {
      return { items: [], user: null };
    }

    return this.attachSignedImageUrlsToWishlist(wishlist);
  }

  private buildPublicShareUrl(shareToken: string) {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return `${frontendUrl}/wishlist/shared/${shareToken}`;
  }

  async getShareLink(userId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);

    return {
      shareToken: wishlist.shareToken,
      url: this.buildPublicShareUrl(wishlist.shareToken),
    };
  }

  async getPublicWishlist(shareToken: string) {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { shareToken },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                basePrice: true,
                brand: true,
                images: { take: 1, orderBy: { position: 'asc' } },
                variants: { select: { stock: true }, take: 1 },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wishlist) {
      throw new NotFoundException('Shared wishlist not found');
    }

    return this.attachSignedImageUrlsToWishlist(wishlist);
  }

  async addItem(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: {
        id: true,
        basePrice: true,
        variants: {
          select: { price: true },
          orderBy: { price: 'asc' },
          take: 1,
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const wishlist = await this.getOrCreateWishlist(userId);

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });
    if (existing) throw new ConflictException('Product already in wishlist');

    const trackedPrice = this.resolveCurrentPrice(product);

    return this.prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId,
        trackedPrice,
      },
    });
  }

  async removeItem(userId: string, productId: string) {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
    });
    if (!wishlist) throw new NotFoundException('Wishlist not found');

    const item = await this.prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });
    if (!item) throw new NotFoundException('Item not in wishlist');

    return this.prisma.wishlistItem.delete({ where: { id: item.id } });
  }
}
