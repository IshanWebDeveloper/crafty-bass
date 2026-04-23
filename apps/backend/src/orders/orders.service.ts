import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  MessageEvent,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import { Observable, filter, map, fromEvent } from 'rxjs';
import { AdminService } from '../admin/admin.service.js';
import { PdfService } from '../admin/pdf.service.js';
import { S3Service } from '../admin/s3.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import type {
  CouponQueryDto,
  CreateOrderDto,
  CreateCouponDto,
  UpdateCouponDto,
  UpdateOrderStatusDto,
  OrderQueryDto,
  ValidateCouponDto,
} from './dto/index.js';
import { CouponValidationEngine } from './coupon-validation.engine.js';
import { PromotionRuleEngine } from './promotion-rule.engine.js';

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['CANCELLED'],
  CANCELLED: ['REFUNDED'],
  REFUNDED: [],
};

interface OrderStatusUpdatePayload {
  status: OrderStatus;
  trackingNumber?: string;
}

type DiscountComponent = {
  source: 'PROMOTION' | 'COUPON';
  amount: number;
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly couponValidationEngine: CouponValidationEngine,
    private readonly promotionRuleEngine: PromotionRuleEngine,
    private readonly adminService: AdminService,
    private readonly pdfService: PdfService,
    private readonly s3Service: S3Service,
    private readonly promotionsService: PromotionsService,
  ) {}

  private resolveDeterministicDiscount(
    subtotalAmount: number,
    components: DiscountComponent[],
    allowStacking = false,
  ): number {
    const activeComponents = components
      .filter((component) => component.amount > 0)
      .sort((a, b) => a.source.localeCompare(b.source));

    if (!allowStacking && activeComponents.length > 1) {
      throw new BadRequestException(
        'Promotions and coupons cannot be stacked in a single checkout. Please remove one and try again.',
      );
    }

    const totalDiscount = activeComponents.reduce(
      (sum, component) => sum + component.amount,
      0,
    );

    return this.toMoney(Math.min(subtotalAmount, Math.max(0, totalDiscount)));
  }

  private async logAdminAction(
    adminId: string | undefined,
    action: string,
    entity: string,
    entityId: string,
    details?: unknown,
  ) {
    if (!adminId) {
      return;
    }

    await this.adminService.log(adminId, action, entity, entityId, details);
  }

  private toMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private mergeGatewayResponse(
    existing: Prisma.JsonValue | null | undefined,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {};

    return {
      ...base,
      ...patch,
    } as Prisma.InputJsonValue;
  }

  private async getCartWithItems(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: { variant: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    return cart;
  }

  private assertStockAvailable(
    cart: Awaited<ReturnType<OrdersService['getCartWithItems']>>,
  ) {
    for (const item of cart.items) {
      if (item.variant.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for variant ${item.variant.sku}. Available: ${item.variant.stock}`,
        );
      }
    }
  }

  private calculateSubtotal(
    cart: Awaited<ReturnType<OrdersService['getCartWithItems']>>,
  ): number {
    return this.toMoney(
      cart.items.reduce(
        (sum, item) => sum + item.quantity * Number(item.variant.price),
        0,
      ),
    );
  }

  private emitOrderCreated(order: {
    id: string;
    userId: string;
    status: OrderStatus;
    updatedAt: Date;
  }) {
    this.eventEmitter.emit('order.created', {
      orderId: order.id,
      userId: order.userId,
      status: order.status,
      updatedAt: order.updatedAt,
    });
  }

  private emitOrderUpdated(order: {
    id: string;
    userId: string;
    status: OrderStatus;
    trackingNumber: string | null;
    updatedAt: Date;
  }) {
    this.eventEmitter.emit('order.updated', {
      orderId: order.id,
      userId: order.userId,
      status: order.status,
      trackingNumber: order.trackingNumber,
      updatedAt: order.updatedAt,
    });
  }

  async hasUserPurchasedProduct(userId: string, productId: string) {
    const purchasedStatuses: OrderStatus[] = [
      'CONFIRMED',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
    ];

    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        order: {
          userId,
          status: { in: purchasedStatuses },
        },
        variant: {
          productId,
        },
      },
      select: { id: true },
    });

    return Boolean(orderItem);
  }

  async checkout(userId: string, dto: CreateOrderDto) {
    const cart = await this.getCartWithItems(userId);
    this.assertStockAvailable(cart);
    const subtotalAmount = this.calculateSubtotal(cart);

    // Create order, order items, deduct stock, clear cart — all in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const normalizedPromotionCode =
        dto.promotionCode?.trim() || dto.promotionId?.trim();
      const normalizedCouponCode = dto.couponCode?.trim();
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const promotionResolution =
        await this.promotionsService.resolveCheckoutPromotion({
          code:
            normalizedPromotionCode && normalizedPromotionCode.length > 0
              ? normalizedPromotionCode
              : undefined,
          subtotalAmount,
          cartProductIds: cart.items.map((item) => item.variant.productId),
          tx,
        });

      const promotionDiscountAmount = promotionResolution
        ? await this.promotionRuleEngine.evaluatePromotionDiscount({
            promotionId: promotionResolution.promotionId,
            userId,
            userRole: user.role,
            subtotalAmount,
            initialDiscountAmount: promotionResolution.discountAmount,
            tx,
          })
        : 0;

      const couponValidation =
        normalizedCouponCode && normalizedCouponCode.length > 0
          ? await this.couponValidationEngine.validate({
              userId,
              code: normalizedCouponCode,
              subtotalAmount,
              tx,
              reserveUsage: true,
            })
          : null;

      const discountAmount = this.resolveDeterministicDiscount(subtotalAmount, [
        {
          source: 'PROMOTION',
          amount: promotionDiscountAmount,
        },
        {
          source: 'COUPON',
          amount: couponValidation?.discountAmount ?? 0,
        },
      ]);
      const amountBeforeTax = this.toMoney(
        Math.max(subtotalAmount - discountAmount, 0),
      );
      const taxRate = await tx.taxRate.findFirst({
        where: { isActive: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      });
      const taxRateId = taxRate?.id ?? null;
      const taxRateValue = Number(taxRate?.rate ?? 0);
      const taxAmount = this.toMoney(amountBeforeTax * taxRateValue);
      const totalAmount = this.toMoney(amountBeforeTax + taxAmount);

      this.logger.debug(
        `Checkout tax applied: foundTaxRate=${Boolean(taxRateId)} taxRateId=${
          taxRateId ?? 'none'
        } taxRate=${taxRateValue} taxAmount=${taxAmount}`,
      );

      // Create order
      const newOrder = await tx.order.create({
        data: {
          userId,
          subtotalAmount,
          discountAmount,
          taxAmount,
          totalAmount,
          promotionId: promotionResolution?.promotionId,
          promotionCode: promotionResolution?.promotionCode,
          couponId: couponValidation?.couponId,
          couponCode: couponValidation?.code,
          taxRateId,
          shippingAddress: dto.shippingAddress,
          status: 'PENDING', // promotion code for reference
          items: {
            create: cart.items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.variant.price,
            })),
          },
        },
        include: {
          items: true,
          promotion: {
            select: {
              id: true,
              code: true,
              type: true,
              value: true,
            },
          },
          coupon: {
            select: {
              id: true,
              code: true,
              discountType: true,
              discountValue: true,
            },
          },
          taxRate: {
            select: {
              id: true,
              name: true,
              rate: true,
              country: true,
            },
          },
        },
      });

      // Deduct stock
      for (const item of cart.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrder;
    });

    this.emitOrderCreated(order);

    return order;
  }

  async validateCoupon(userId: string, dto: ValidateCouponDto) {
    const cart = await this.getCartWithItems(userId);
    const subtotalAmount = this.calculateSubtotal(cart);

    const validation = await this.couponValidationEngine.validate({
      userId,
      code: dto.code,
      subtotalAmount,
    });

    return {
      ...validation,
      itemCount: cart.items.length,
    };
  }

  async createCoupon(dto: CreateCouponDto, adminId?: string) {
    const code = this.couponValidationEngine.normalizeCode(dto.code);
    const existing = await this.prisma.coupon.findUnique({
      where: { code: code },
    });

    if (existing) {
      throw new ConflictException('Coupon code already exists');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderAmount: dto.minOrderAmount,
        maxDiscountAmount: dto.maxDiscountAmount,
        usageLimit: dto.usageLimit,
        usageLimitPerUser: dto.usageLimitPerUser,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        isActive: dto.isActive,
      },
    });

    await this.logAdminAction(adminId, 'COUPON_CREATE', 'coupon', coupon.id, {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });

    return { message: 'Coupon created successfully', coupon };
  }

  async listCoupons(query: CouponQueryDto) {
    const { page, limit, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CouponWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      data: coupons,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findCouponById(couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return { coupon };
  }

  async updateCoupon(couponId: string, dto: UpdateCouponDto, adminId?: string) {
    const existingCoupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!existingCoupon) {
      throw new NotFoundException('Coupon not found');
    }

    const data: Prisma.CouponUpdateInput = {};

    if (dto.code !== undefined) {
      const code = this.couponValidationEngine.normalizeCode(dto.code);

      const duplicate = await this.prisma.coupon.findUnique({
        where: { code },
        select: { id: true },
      });

      if (duplicate && duplicate.id !== couponId) {
        throw new ConflictException('Coupon code already exists');
      }

      data.code = code;
    }

    if (dto.description !== undefined) data.description = dto.description;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.minOrderAmount !== undefined)
      data.minOrderAmount = dto.minOrderAmount;
    if (dto.maxDiscountAmount !== undefined) {
      data.maxDiscountAmount = dto.maxDiscountAmount;
    }
    if (dto.usageLimit !== undefined) {
      if (dto.usageLimit < existingCoupon.usedCount) {
        throw new BadRequestException(
          `usageLimit cannot be less than current usedCount (${existingCoupon.usedCount})`,
        );
      }
      data.usageLimit = dto.usageLimit;
    }
    if (dto.usageLimitPerUser !== undefined) {
      data.usageLimitPerUser = dto.usageLimitPerUser;
    }
    if (dto.startsAt !== undefined) {
      data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    }
    if (dto.endsAt !== undefined) {
      data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const coupon = await this.prisma.coupon.update({
      where: { id: couponId },
      data,
    });

    await this.logAdminAction(
      adminId,
      'COUPON_UPDATE',
      'coupon',
      coupon.id,
      dto,
    );

    return { coupon };
  }

  async deactivateCoupon(couponId: string, adminId?: string) {
    const existingCoupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true },
    });

    if (!existingCoupon) {
      throw new NotFoundException('Coupon not found');
    }

    const updatedCoupon = await this.prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: false },
    });

    await this.logAdminAction(
      adminId,
      'COUPON_DEACTIVATE',
      'coupon',
      updatedCoupon.id,
      { code: updatedCoupon.code },
    );

    return { coupon: updatedCoupon };
  }

  async findUserOrders(userId: string, query: OrderQueryDto) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: { select: { name: true, slug: true } },
                },
              },
            },
          },
          payment: { select: { status: true, method: true } },
          coupon: {
            select: {
              id: true,
              code: true,
              discountType: true,
              discountValue: true,
            },
          },
          promotion: {
            select: {
              id: true,
              code: true,
              type: true,
              value: true,
            },
          },
          taxRate: { select: { name: true, rate: true, country: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findAllOrders(query: OrderQueryDto) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              variant: { include: { product: { select: { name: true } } } },
            },
          },
          payment: true,
          coupon: {
            select: {
              id: true,
              code: true,
              discountType: true,
              discountValue: true,
            },
          },
          promotion: {
            select: {
              id: true,
              code: true,
              type: true,
              value: true,
            },
          },
          taxRate: { select: { name: true, rate: true, country: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findById(orderId: string, userId?: string) {
    const where: Record<string, unknown> = { id: orderId };
    if (userId) where.userId = userId;

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: {
          include: {
            variant: {
              include: { product: { select: { name: true, slug: true } } },
            },
          },
        },
        payment: true,
        coupon: {
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
          },
        },
        promotion: {
          select: {
            id: true,
            code: true,
            type: true,
            value: true,
          },
        },
        taxRate: { select: { name: true, rate: true, country: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getInvoiceDownloadUrl(orderId: string, userId?: string) {
    const where: Prisma.OrderWhereInput = userId
      ? { id: orderId, userId }
      : { id: orderId };

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        payment: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment?.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Invoice is available only after payment is completed',
      );
    }

    const shippingAddress = this.extractShippingAddress(order.shippingAddress);

    const pdfBuffer = await this.pdfService.generateOrderInvoicePdf({
      orderId: order.id,
      orderDate: order.createdAt,
      customerName: order.user.name,
      customerEmail: order.user.email,
      shippingAddress,
      paymentStatus: order.payment.status,
      orderStatus: order.status,
      items: order.items.map((item) => ({
        name: item.variant.product.name,
        sku: item.variant.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
      subtotalAmount: Number(order.subtotalAmount),
      discountAmount: Number(order.discountAmount),
      taxAmount: Number(order.taxAmount),
      totalAmount: Number(order.totalAmount),
      promotionCode: order.promotionCode,
      couponCode: order.couponCode,
    });

    const objectKey = `orders/invoices/${order.id}.pdf`;
    await this.s3Service.uploadObject(objectKey, pdfBuffer, 'application/pdf');

    const downloadName = `invoice-${order.id.split('-')[0] ?? order.id}.pdf`;
    return this.s3Service.getPresignedDownloadUrl(objectKey, 900, downloadName);
  }

  private extractShippingAddress(
    shippingAddress: Prisma.JsonValue | null,
  ): Record<string, string> {
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      return {};
    }

    const source = shippingAddress as Record<string, unknown>;
    const normalize = (value: unknown): string =>
      typeof value === 'string' ? value.trim() : '';

    return {
      line1: normalize(source.line1) || normalize(source.street),
      line2: normalize(source.line2),
      city: normalize(source.city),
      state: normalize(source.state),
      postalCode: normalize(source.postalCode),
      country: normalize(source.country),
    };
  }

  async updateStatus(
    orderId: string,
    dto: OrderStatusUpdatePayload | UpdateOrderStatusDto,
    adminId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}`,
      );
    }

    const data: Record<string, unknown> = {
      status: dto.status,
    };
    if (dto.trackingNumber) {
      data.trackingNumber = dto.trackingNumber;
    }

    const { order: updatedOrder, codPaymentCompleted } =
      await this.prisma.$transaction(async (tx) => {
        const nextOrder = await tx.order.update({
          where: { id: orderId },
          data,
        });

        if (dto.status !== 'DELIVERED') {
          return { order: nextOrder, codPaymentCompleted: false };
        }

        const payment = await tx.payment.findUnique({
          where: { orderId },
          select: {
            method: true,
            status: true,
            gatewayResponse: true,
          },
        });

        if (
          !payment ||
          payment.method !== 'CASH_ON_DELIVERY' ||
          payment.status !== 'PENDING'
        ) {
          return { order: nextOrder, codPaymentCompleted: false };
        }

        await tx.payment.update({
          where: { orderId },
          data: {
            status: 'COMPLETED',
            gatewayResponse: this.mergeGatewayResponse(
              payment.gatewayResponse,
              {
                cod: {
                  completedAt: new Date().toISOString(),
                  completionSource: 'order-delivered',
                },
              },
            ),
          },
        });

        return { order: nextOrder, codPaymentCompleted: true };
      });

    await this.logAdminAction(
      adminId,
      'ORDER_STATUS_UPDATE',
      'order',
      updatedOrder.id,
      {
        status: updatedOrder.status,
        trackingNumber: updatedOrder.trackingNumber,
      },
    );

    if (codPaymentCompleted) {
      await this.logAdminAction(
        adminId,
        'PAYMENT_COD_COMPLETED',
        'payment',
        updatedOrder.id,
        {
          orderId: updatedOrder.id,
          status: 'COMPLETED',
          trigger: 'order-delivered',
        },
      );
    }

    this.emitOrderUpdated(updatedOrder);

    return updatedOrder;
  }

  /**
   * Dev-only automation to keep orders moving through all lifecycle stages.
   * Advances PENDING -> AWAITING_PAYMENT -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED.
   */
  @Cron('*/6 * * * * *')
  async devAutoAdvanceFulfillment() {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const cutoff = new Date(Date.now() - 6 * 1000);
    const candidates = await this.prisma.order.findMany({
      where: {
        status: {
          in: [
            'PENDING',
            'AWAITING_PAYMENT',
            'CONFIRMED',
            'PROCESSING',
            'SHIPPED',
          ],
        },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, status: true },
    });

    for (const order of candidates) {
      const nextStatus =
        order.status === 'PENDING'
          ? 'AWAITING_PAYMENT'
          : order.status === 'AWAITING_PAYMENT'
            ? 'CONFIRMED'
            : order.status === 'CONFIRMED'
              ? 'PROCESSING'
              : order.status === 'PROCESSING'
                ? 'SHIPPED'
                : order.status === 'SHIPPED'
                  ? 'DELIVERED'
                  : null;

      if (!nextStatus) {
        continue;
      }

      try {
        await this.updateStatus(order.id, { status: nextStatus });
      } catch (error) {
        this.logger.debug(
          `Skipping dev auto-advance for order ${order.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async assertCanTrackOrder(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (role !== 'ADMIN' && order.userId !== userId) {
      throw new ForbiddenException('You cannot track this order');
    }
  }

  async cancelOrder(
    orderId: string,
    requesterUserId: string,
    requesterRole: string,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (requesterRole !== 'ADMIN' && order.userId !== requesterUserId) {
      throw new ForbiddenException('You cannot cancel this order');
    }

    const cancellableStatuses: OrderStatus[] = [
      'PENDING',
      'AWAITING_PAYMENT',
      'CONFIRMED',
      'PROCESSING',
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order in ${order.status} status cannot be cancelled`,
      );
    }

    const cancelledOrder = await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }

      if (order.couponId) {
        await tx.coupon.updateMany({
          where: { id: order.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          ...(reason ? { notes: reason } : {}),
        },
      });
    });

    if (requesterRole === 'ADMIN') {
      await this.logAdminAction(
        requesterUserId,
        'ORDER_CANCEL',
        'order',
        cancelledOrder.id,
        { reason: reason ?? null, previousStatus: order.status },
      );
    }

    this.emitOrderUpdated(cancelledOrder);

    return cancelledOrder;
  }

  trackOrder(orderId: string): Observable<MessageEvent> {
    return fromEvent(this.eventEmitter, 'order.updated').pipe(
      filter(
        (
          payload: unknown,
        ): payload is {
          orderId: string;
          status: OrderStatus;
          trackingNumber: string | null;
          updatedAt: Date;
        } => {
          const p = payload as { orderId?: string };
          return p != null && p.orderId === orderId;
        },
      ),
      map((payload) => {
        return {
          data: {
            status: payload.status,
            trackingNumber: payload.trackingNumber,
            updatedAt: payload.updatedAt,
          },
        } as MessageEvent;
      }),
    );
  }
}
