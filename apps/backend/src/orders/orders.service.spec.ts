import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { CreateOrderDto } from './dto/index.js';

jest.mock('@thallesp/nestjs-better-auth', () => ({
  AuthService: class AuthService {},
}));

describe('OrdersService.checkout', () => {
  const createOrderDto: CreateOrderDto = {
    shippingAddress: {
      street: '123 Main St',
      city: 'Colombo',
      state: 'Western',
      postalCode: '00100',
      country: 'Sri Lanka',
    },
  };

  function buildService() {
    const tx = {
      user: {
        findUnique: jest.fn(),
      },
      taxRate: {
        findFirst: jest.fn(),
      },
      productVariant: {
        update: jest.fn(),
      },
      order: {
        create: jest.fn(),
      },
      cartItem: {
        deleteMany: jest.fn(),
      },
    };

    const prisma = {
      cart: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    } as unknown as PrismaService;

    const eventEmitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    const couponValidationEngine = {
      validate: jest.fn(),
    };

    const promotionRuleEngine = {
      evaluatePromotionDiscount: jest.fn(),
    };

    const promotionsService = {
      resolveCheckoutPromotion: jest.fn().mockResolvedValue(null),
    };

    const adminService = {
      log: jest.fn(),
    };

    const pdfService = {};
    const s3Service = {};

    const service = new OrdersService(
      prisma,
      eventEmitter,
      couponValidationEngine as any,
      promotionRuleEngine as any,
      adminService as any,
      pdfService as any,
      s3Service as any,
      promotionsService as any,
    );

    return { service, prisma, tx };
  }

  it('rejects checkout when cart is empty', async () => {
    const { service, prisma } = buildService();

    prisma.cart.findUnique.mockResolvedValueOnce(null);

    await expect(service.checkout('user-1', createOrderDto)).rejects.toThrow(
      new BadRequestException('Cart is empty'),
    );
  });

  it('rejects checkout when stock is insufficient during atomic decrement', async () => {
    const { service, prisma, tx } = buildService();

    prisma.cart.findUnique.mockResolvedValueOnce({
      id: 'cart-1',
      items: [
        {
          variantId: 'variant-1',
          quantity: 3,
          variant: {
            sku: 'SKU-1',
            stock: 1,
            price: 100,
            productId: 'product-1',
          },
        },
      ],
    });

    await expect(service.checkout('user-1', createOrderDto)).rejects.toThrow(
      new BadRequestException(
        'Insufficient stock for variant SKU-1. Available: 1',
      ),
    );

    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it('creates order and clears cart when stock is available', async () => {
    const { service, prisma, tx } = buildService();

    prisma.cart.findUnique.mockResolvedValueOnce({
      id: 'cart-1',
      items: [
        {
          variantId: 'variant-1',
          quantity: 2,
          variant: {
            sku: 'SKU-1',
            stock: 10,
            price: 50,
            productId: 'product-1',
          },
        },
      ],
    });

    tx.user.findUnique.mockResolvedValueOnce({ role: 'CUSTOMER' });
    tx.taxRate.findFirst.mockResolvedValueOnce(null);
    tx.order.create.mockResolvedValueOnce({
      id: 'order-1',
      userId: 'user-1',
      status: 'PENDING',
      updatedAt: new Date('2026-04-06T00:00:00.000Z'),
      items: [],
    });
    tx.productVariant.update.mockResolvedValueOnce({ id: 'variant-1' });
    tx.cartItem.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.checkout('user-1', createOrderDto);

    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: {
        id: 'variant-1',
      },
      data: {
        stock: {
          decrement: 2,
        },
      },
    });

    expect(tx.order.create).toHaveBeenCalled();

    const orderCreateCall = tx.order.create.mock.calls[0] as [
      {
        data: {
          userId: string;
          totalAmount: number;
          shippingAddress: {
            street: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
          };
        };
      },
    ];

    const orderCreateArgs = orderCreateCall[0];

    expect(orderCreateArgs.data.userId).toBe('user-1');
    expect(orderCreateArgs.data.totalAmount).toBe(100);
    expect(orderCreateArgs.data.subtotalAmount).toBe(100);
    expect(orderCreateArgs.data.discountAmount).toBe(0);
    expect(orderCreateArgs.data.taxAmount).toBe(0);
    expect(orderCreateArgs.data.shippingAddress).toEqual({
      street: '123 Main St',
      city: 'Colombo',
      state: 'Western',
      postalCode: '00100',
      country: 'Sri Lanka',
    });

    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 'cart-1' },
    });
    expect(result).toEqual(
      expect.objectContaining({ id: 'order-1', items: [] }),
    );
  });
});
