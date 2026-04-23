import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { AddCartItemDto, UpdateCartItemDto } from './dto/index.js';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    return cart;
  }

  async getCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    images: { take: 1, orderBy: { position: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return { items: [], totalItems: 0, totalPrice: 0 };
    }

    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.items.reduce(
      (sum, item) => sum + item.quantity * Number(item.variant.price),
      0,
    );

    return { ...cart, totalItems, totalPrice };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const cart = await this.getOrCreateCart(userId);

    // Verify variant exists and has stock
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: { select: { isActive: true } } },
    });

    if (!variant || !variant.product.isActive) {
      throw new NotFoundException('Product variant not found or unavailable');
    }

    if (variant.stock < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${variant.stock}`,
      );
    }

    // Upsert cart item (increment if already exists)
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId: { cartId: cart.id, variantId: dto.variantId },
      },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + dto.quantity;
      if (newQty > variant.stock) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${variant.stock}`,
        );
      }

      return this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        variantId: dto.variantId,
        quantity: dto.quantity,
      },
    });
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true, variant: true },
    });

    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException('Cart item not found');
    }

    if (dto.quantity > item.variant.stock) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${item.variant.stock}`,
      );
    }

    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException('Cart item not found');
    }

    return this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) return { message: 'Cart is already empty' };

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { message: 'Cart cleared' };
  }
}
