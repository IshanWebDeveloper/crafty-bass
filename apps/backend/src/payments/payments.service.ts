import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ConsoleLogger,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Prisma } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { Resend } from 'resend';
import type { InitiateCheckoutDto, RefundRequestDto } from './dto/index.js';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;
  private readonly logger = new ConsoleLogger({
    prefix: 'PaymentsService',
    timestamp: true,
  });
  private readonly resend?: Resend;
  private readonly emailFrom: string;
  private readonly frontendUrl: string;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }

    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = resendApiKey ? new Resend(resendApiKey) : undefined;
    this.emailFrom =
      this.config.get<string>('RESEND_FROM_EMAIL') ??
      'StreetGadgets <onboarding@resend.dev>';
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    this.apiBaseUrl =
      this.config.get<string>('NEXT_PUBLIC_API_URL')?.replace(/\/$/, '') ??
      this.config.get<string>('API_BASE_URL')?.replace(/\/$/, '') ??
      this.config.get<string>('BACKEND_PUBLIC_API_URL')?.replace(/\/$/, '') ??
      'http://localhost:3005/api/v1';
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

  private buildOrderIdempotencyKey(orderId: string): string {
    return `order_${orderId}`;
  }

  private getCheckoutUrlFromGatewayResponse(
    gatewayResponse: Prisma.JsonValue | null | undefined,
  ): string | null {
    if (
      !gatewayResponse ||
      typeof gatewayResponse !== 'object' ||
      Array.isArray(gatewayResponse)
    ) {
      return null;
    }

    const response = gatewayResponse as Record<string, unknown>;
    const checkoutSession = response.checkoutSession;

    if (
      checkoutSession &&
      typeof checkoutSession === 'object' &&
      !Array.isArray(checkoutSession)
    ) {
      const url = (checkoutSession as Record<string, unknown>).url;
      if (typeof url === 'string' && url.length > 0) {
        return url;
      }
    }

    const topLevelUrl = response.url;
    if (typeof topLevelUrl === 'string' && topLevelUrl.length > 0) {
      return topLevelUrl;
    }

    return null;
  }

  private toAuditJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(value, (_, nestedValue: unknown) => {
        if (typeof nestedValue === 'bigint') {
          return nestedValue.toString();
        }
        if (nestedValue instanceof Date) {
          return nestedValue.toISOString();
        }
        return nestedValue;
      }),
    ) as Prisma.InputJsonValue;
  }

  private async logAudit(
    userId: string | undefined,
    action: string,
    entity: string,
    entityId: string,
    details?: unknown,
  ) {
    if (!userId) {
      return;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          ...(details !== undefined
            ? {
                details: this.toAuditJson(details),
              }
            : {}),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write audit log ${action} for ${entity} ${entityId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async ensureRefundSupportTicket(
    orderId: string,
    customerId: string,
    actorId?: string,
    reason?: string,
  ) {
    const existingTicket = await this.prisma.supportTicket.findFirst({
      where: {
        orderId,
        OR: [
          { category: 'RETURN_REQUEST' },
          {
            subject: {
              contains: 'refund',
              mode: 'insensitive',
            },
          },
          {
            subject: {
              contains: 'return',
              mode: 'insensitive',
            },
          },
        ],
      },
      select: { id: true },
    });

    if (existingTicket) {
      return existingTicket.id;
    }

    const shortOrderId = orderId.slice(0, 8);
    const trimmedReason = reason?.trim();
    const messageBody = [
      `Customer requested a refund for order #${shortOrderId}.`,
      trimmedReason ? `Reason: ${trimmedReason}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n\n');

    const createdTicket = await this.prisma.supportTicket.create({
      data: {
        userId: customerId,
        orderId,
        subject: `Refund request for order #${shortOrderId}`,
        category: 'RETURN_REQUEST',
        priority: 'HIGH',
        messages: {
          create: {
            senderId: actorId ?? customerId,
            body: messageBody,
          },
        },
      },
      select: { id: true },
    });

    return createdTicket.id;
  }

  async initiateCheckout(userId: string, dto: InitiateCheckoutDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId },
      include: {
        items: {
          include: {
            variant: {
              include: { product: { select: { name: true } } },
            },
          },
        },
        user: { select: { stripeCustomerId: true, email: true } },
        taxRate: { select: { name: true, rate: true, country: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const paymentMethod = dto.paymentMethod ?? 'STRIPE';
    const idempotencyKey = this.buildOrderIdempotencyKey(order.id);

    if (paymentMethod === 'STRIPE') {
      if (!this.stripe) {
        throw new BadRequestException('Stripe is not configured');
      }

      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          method: 'STRIPE',
          OR: [{ orderId: order.id }, { idempotencyKey }],
        },
        select: {
          transactionId: true,
          gatewayResponse: true,
        },
      });

      if (existingPayment?.transactionId) {
        const fallbackCheckoutUrl = this.getCheckoutUrlFromGatewayResponse(
          existingPayment.gatewayResponse,
        );

        try {
          const existingSession = await this.stripe.checkout.sessions.retrieve(
            existingPayment.transactionId,
          );

          const checkoutUrl = existingSession.url ?? fallbackCheckoutUrl;
          if (!checkoutUrl) {
            throw new BadRequestException(
              'Existing checkout session has no URL',
            );
          }

          return {
            paymentMethod: 'STRIPE' as const,
            checkoutUrl,
            sessionId: existingPayment.transactionId,
          };
        } catch (error) {
          if (fallbackCheckoutUrl) {
            return {
              paymentMethod: 'STRIPE' as const,
              checkoutUrl: fallbackCheckoutUrl,
              sessionId: existingPayment.transactionId,
            };
          }

          this.logger.warn(
            `Failed to resume checkout session for order ${order.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Order is in ${order.status} state, cannot checkout`,
      );
    }

    if (paymentMethod === 'CASH_ON_DELIVERY') {
      await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          method: 'CASH_ON_DELIVERY',
          status: 'PENDING',
          amount: order.totalAmount,
          transactionId: null,
          gatewayResponse: this.mergeGatewayResponse(undefined, {
            cod: {
              requestedAt: new Date().toISOString(),
              source: 'checkout',
            },
          }),
        },
        create: {
          orderId: order.id,
          method: 'CASH_ON_DELIVERY',
          status: 'PENDING',
          amount: order.totalAmount,
          gatewayResponse: {
            cod: {
              requestedAt: new Date().toISOString(),
              source: 'checkout',
            },
          } as Prisma.InputJsonValue,
        },
      });

      await this.ordersService.updateStatus(order.id, {
        status: 'AWAITING_PAYMENT',
      });

      await this.ordersService.updateStatus(order.id, {
        status: 'CONFIRMED',
      });

      await this.logAudit(userId, 'PAYMENT_COD_SELECTED', 'payment', order.id, {
        orderId: order.id,
        amount: Number(order.totalAmount),
        method: 'CASH_ON_DELIVERY',
      });

      return {
        orderId: order.id,
        paymentMethod: 'CASH_ON_DELIVERY' as const,
        status: 'CONFIRMED' as const,
      };
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    // Build Stripe line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      order.items.map((item) => ({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: item.variant.product.name,
            metadata: { variantId: item.variantId },
          },
          unit_amount: Math.round(Number(item.unitPrice) * 100),
        },
        quantity: item.quantity,
      }));

    // Apply order discount via Stripe coupon so checkout total is reduced correctly.
    const discountAmount = Number(order.discountAmount ?? 0);
    const discountMinor = Math.max(0, Math.round(discountAmount * 100));
    let checkoutDiscounts:
      | Stripe.Checkout.SessionCreateParams.Discount[]
      | undefined;

    if (discountAmount > 0) {
      const stripeCoupon = await this.stripe.coupons.create({
        duration: 'once',
        amount_off: discountMinor,
        currency: 'gbp',
        name: `Order discount ${order.id.split('-')[0] ?? order.id}`,
        metadata: {
          orderId: order.id,
          promotionCode: order.promotionCode ?? '',
          couponCode: order.couponCode ?? '',
        },
      });

      checkoutDiscounts = [{ coupon: stripeCoupon.id }];
    }
    // Create (or derive) a Stripe tax rate and attach to line items
    // Derive a tax percentage to create a Stripe Tax Rate.
    // Prefer taxRate.rate from the DB, otherwise derive from recorded taxAmount and subtotal/discount.
    const recordedTaxAmount = Number(order.taxAmount ?? 0);
    const subtotal = Number(order.subtotalAmount ?? 0);
    const discount = Number(order.discountAmount ?? 0);
    const baseForTax = Math.max(subtotal - discount, 0);

    let stripeTaxPercentage = 0;
    if (order.taxRate?.rate) {
      stripeTaxPercentage = Number(order.taxRate.rate) * 100;
    } else if (recordedTaxAmount > 0 && baseForTax > 0) {
      // derive percentage: tax / base
      stripeTaxPercentage = (recordedTaxAmount / baseForTax) * 100;
    }

    let taxRate: Stripe.TaxRate | null = null;
    if (stripeTaxPercentage > 0) {
      taxRate = await this.stripe.taxRates.create({
        display_name: order.taxRate?.name ?? 'Tax',
        description: order.taxRate?.name ? `${order.taxRate.name} tax` : 'Tax',
        jurisdiction: order.taxRate?.country ?? undefined,
        percentage: Number(stripeTaxPercentage),
        inclusive: false,
      });

      // Attach created tax rate to each product line item so Stripe applies tax
      if (taxRate && taxRate.id) {
        for (const li of lineItems) {
          li.tax_rates = [taxRate.id];
        }
      }
    }
    // Create Stripe Checkout Session
    const baseUrl =
      this.config.get<string>('BETTER_AUTH_URL') ?? 'http://localhost:3000';
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer: order.user.stripeCustomerId ?? undefined,
        customer_email: order.user.stripeCustomerId
          ? undefined
          : (order?.user?.email ?? undefined),
        line_items: lineItems,
        discounts: checkoutDiscounts,
        locale: 'en-GB',
        currency: 'gbp',
        metadata: { orderId: order.id },
        success_url:
          dto.successUrl ?? `${baseUrl}/orders/${order.id}?payment=success`,
        cancel_url:
          dto.cancelUrl ?? `${baseUrl}/orders/${order.id}?payment=cancelled`,
      },
      {
        idempotencyKey,
      },
    );

    // Create Payment record (order status update via OrdersService for SSE)
    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        idempotencyKey,
        method: 'STRIPE',
        status: 'PENDING',
        amount: order.totalAmount,
        transactionId: session.id,
        gatewayResponse: this.mergeGatewayResponse(undefined, {
          checkoutSession: {
            id: session.id,
            url: session.url,
            status: session.status,
            paymentStatus: session.payment_status,
          },
          stripeRequest: {
            idempotencyKey,
          },
        }),
      },
      create: {
        orderId: order.id,
        idempotencyKey,
        method: 'STRIPE',
        status: 'PENDING',
        amount: order.totalAmount,
        transactionId: session.id,
        gatewayResponse: {
          checkoutSession: {
            id: session.id,
            url: session.url,
            status: session.status,
            paymentStatus: session.payment_status,
          },
          stripeRequest: {
            idempotencyKey,
          },
        } as Prisma.InputJsonValue,
      },
    });

    await this.ordersService.updateStatus(order.id, {
      status: 'AWAITING_PAYMENT',
    });

    await this.logAudit(
      userId,
      'PAYMENT_CHECKOUT_INITIATED',
      'payment',
      order.id,
      {
        orderId: order.id,
        amount: Number(order.totalAmount),
        method: 'STRIPE',
        hasDiscount: Number(order.discountAmount ?? 0) > 0,
        sessionId: session.id,
      },
    );

    return {
      paymentMethod: 'STRIPE' as const,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await this.handleCheckoutSessionCompleted(session);
    }

    if (event.type === 'payment_intent.succeeded') {
      Logger.log('Payment intent succeeded', event.data.object);
      const session = event.data.object;
      await this.handlePaymentIntentSucceeded(session);
    }

    if (event.type === 'refund.created') {
      const refund = event.data.object;
      this.logger.log(
        `Received refund.created webhook for refund ${refund.id} on payment intent ${JSON.stringify(refund.payment_intent)}`,
      );
    }
    return { received: true };
  }

  async getPaymentStatus(orderId: string, userId?: string) {
    const where: Record<string, unknown> = { id: orderId };
    if (userId) where.userId = userId;

    const order = await this.prisma.order.findFirst({
      where,
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order.payment ?? { status: 'NO_PAYMENT', orderId };
  }

  async resolveCheckoutSession(sessionId: string, userId?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: sessionId },
      include: { order: { select: { id: true, userId: true } } },
    });

    if (!payment || !payment.order) {
      throw new NotFoundException('Payment session not found');
    }

    if (userId && payment.order.userId !== userId) {
      throw new NotFoundException('Payment session not found');
    }

    return { orderId: payment.order.id };
  }

  async requestRefund(
    orderId: string,
    userId?: string,
    dto?: RefundRequestDto,
    actorId?: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...(userId ? { userId } : {}),
      },
      include: {
        payment: {
          select: {
            status: true,
            method: true,
            gatewayResponse: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    let payment = order.payment;

    if (
      payment &&
      order.status === 'DELIVERED' &&
      payment.method === 'CASH_ON_DELIVERY' &&
      payment.status === 'PENDING'
    ) {
      payment = await this.prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: 'COMPLETED',
          gatewayResponse: this.mergeGatewayResponse(payment.gatewayResponse, {
            cod: {
              completedAt: new Date().toISOString(),
              completionSource: 'refund-request',
            },
          }),
        },
        select: {
          status: true,
          method: true,
          gatewayResponse: true,
        },
      });
    }

    if (!payment || payment.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Refund can only be requested for completed payments',
      );
    }

    if (order.status === 'REFUNDED') {
      throw new ConflictException('Order is already refunded');
    }

    if (order.status === 'CANCELLED') {
      await this.ensureRefundSupportTicket(
        order.id,
        order.userId,
        actorId,
        dto?.reason,
      );

      await this.logAudit(
        actorId ?? userId,
        'PAYMENT_REFUND_REQUEST_DUPLICATE',
        'payment',
        order.id,
        {
          orderId: order.id,
          status: order.status,
        },
      );

      return {
        message: 'Refund request already submitted',
        status: order.status,
      };
    }

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException(
        `Cannot request refund for order in ${order.status} state`,
      );
    }

    await this.ordersService.updateStatus(orderId, {
      status: 'CANCELLED',
    });

    await this.prisma.payment.update({
      where: { orderId },
      data: {
        gatewayResponse: this.mergeGatewayResponse(payment.gatewayResponse, {
          refundRequest: {
            requestedAt: new Date().toISOString(),
            reason: dto?.reason?.trim() || null,
          },
        }),
      },
    });

    await this.logAudit(
      actorId ?? userId,
      'PAYMENT_REFUND_REQUESTED',
      'payment',
      order.id,
      {
        orderId: order.id,
        reason: dto?.reason?.trim() || null,
        orderStatus: 'CANCELLED',
      },
    );

    await this.ensureRefundSupportTicket(
      order.id,
      order.userId,
      actorId,
      dto?.reason,
    );

    return { message: 'Refund requested', status: 'CANCELLED' };
  }

  async refund(orderId: string, dto: RefundRequestDto, actorId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.payment) {
      throw new NotFoundException('Payment not found');
    }

    const payment = order.payment;

    if (order.status === 'REFUNDED' || payment.status === 'REFUNDED') {
      throw new ConflictException('Order is already refunded');
    }

    if (!['CANCELLED', 'DELIVERED'].includes(order.status)) {
      throw new BadRequestException(
        `Refund can only be completed for delivered orders with a refund request. Current status: ${order.status}`,
      );
    }

    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException('Can only refund completed payments');
    }

    if (payment.method !== 'STRIPE') {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { orderId },
          data: {
            status: 'REFUNDED',
            gatewayResponse: this.mergeGatewayResponse(
              payment.gatewayResponse,
              {
                manualRefund: {
                  method: payment.method,
                  reason: dto.reason?.trim() || null,
                  refundedAt: new Date().toISOString(),
                },
              },
            ),
          },
        }),
        this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'REFUNDED' },
        }),
      ]);

      await this.logAudit(
        actorId,
        'PAYMENT_REFUND_COMPLETED',
        'payment',
        order.id,
        {
          orderId: order.id,
          method: payment.method,
          reason: dto.reason?.trim() || null,
          status: 'REFUNDED',
        },
      );

      return { status: 'REFUNDED', method: payment.method };
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    if (!payment.transactionId) {
      throw new BadRequestException('No transaction ID found for this payment');
    }

    // Get the Stripe payment intent from the checkout session
    const session = await this.stripe.checkout.sessions.retrieve(
      payment.transactionId,
    );

    if (!session.payment_intent) {
      throw new BadRequestException('No payment intent found for this session');
    }

    const refund = await this.stripe.refunds.create({
      payment_intent: session.payment_intent as string,
      reason: 'requested_by_customer',
      metadata: { orderId, reason: dto.reason ?? '' },
    });

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { orderId },
        data: {
          status: 'REFUNDED',
          gatewayResponse: this.mergeGatewayResponse(payment.gatewayResponse, {
            refund: JSON.parse(JSON.stringify(refund)) as Prisma.InputJsonValue,
            refundedAt: new Date().toISOString(),
            refundReason: dto.reason?.trim() || null,
          }),
        },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'REFUNDED' },
      }),
    ]);

    await this.logAudit(
      actorId,
      'PAYMENT_REFUND_COMPLETED',
      'payment',
      order.id,
      {
        orderId: order.id,
        method: payment.method,
        refundId: refund.id,
        reason: dto.reason?.trim() || null,
        status: 'REFUNDED',
      },
    );

    return { refundId: refund.id, status: 'REFUNDED' };
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        payment: { select: { status: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const alreadyCompleted = order.payment?.status === 'COMPLETED';

    await this.prisma.payment.upsert({
      where: { orderId },
      update: {
        status: 'COMPLETED',
        transactionId: session.id ?? undefined,
        gatewayResponse: JSON.parse(
          JSON.stringify(session),
        ) as Prisma.InputJsonValue,
      },
      create: {
        orderId,
        method: 'STRIPE',
        status: 'COMPLETED',
        amount: order.totalAmount,
        transactionId: session.id ?? undefined,
      },
    });

    if (order.status === 'PENDING') {
      await this.ordersService.updateStatus(orderId, {
        status: 'AWAITING_PAYMENT',
      });
    }

    if (order.status === 'PENDING' || order.status === 'AWAITING_PAYMENT') {
      await this.ordersService.updateStatus(orderId, {
        status: 'CONFIRMED',
      });
    }

    if (!alreadyCompleted) {
      await this.sendInvoiceEmail(order.id, order.user.email, order.user.name);

      await this.logAudit(
        order.user.id,
        'PAYMENT_CHECKOUT_COMPLETED',
        'payment',
        order.id,
        {
          orderId: order.id,
          sessionId: session.id,
          amount: Number(order.totalAmount),
        },
      );
    }
  }

  private async handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
    this.logger.log('Received payment_intent.succeeded webhook');
    const sessionId = intent.metadata?.sessionId;
    if (!sessionId) {
      throw new BadRequestException(
        'No session ID found in payment intent metadata',
      );
    }

    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: sessionId },
      include: { order: { select: { id: true, userId: true } } },
    });

    if (!payment || !payment.order) {
      throw new NotFoundException('Payment session not found');
    }

    await this.prisma.payment.update({
      where: { orderId: payment.order.id },
      data: {
        status: 'COMPLETED',
        gatewayResponse: this.mergeGatewayResponse(payment.gatewayResponse, {
          paymentIntent: JSON.parse(
            JSON.stringify(intent),
          ) as Prisma.InputJsonValue,
          completedAt: new Date().toISOString(),
        }),
      },
    });
  }

  private async sendInvoiceEmail(
    orderId: string,
    email: string,
    name: string | null,
  ) {
    if (!this.resend || !email) return;

    const orderUrl = `${this.frontendUrl}/orders/${orderId}`;
    let invoiceUrl = `${this.apiBaseUrl}/orders/${orderId}/invoice`;

    try {
      invoiceUrl = await this.ordersService.getInvoiceDownloadUrl(orderId);
    } catch (error) {
      this.logger.warn(
        `Failed to generate presigned invoice URL for order ${orderId}, falling back to API endpoint: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      await this.resend.emails.send({
        to: email,
        from: this.emailFrom,
        subject: `Your invoice for order #${orderId.split('-')[0]}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto;">
            <h2>Thanks for your purchase${name ? `, ${name}` : ''}!</h2>
            <p>Your payment was successful. You can view and download your invoice using the link below.</p>
            <p style="margin: 24px 0;">
              <a href="${invoiceUrl}" style="background-color: #0f172a; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                View Order & Download Invoice
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">
              Direct download link (expires in 15 minutes): ${invoiceUrl}
            </p>
            <p style="color: #64748b; font-size: 14px;">
              If the button doesn't work, open this link: ${orderUrl}
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send invoice email for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
