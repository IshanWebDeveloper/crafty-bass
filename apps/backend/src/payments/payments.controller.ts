import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { PaymentsService } from './payments.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { InitiateCheckoutDto, RefundRequestDto } from './dto/index.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate checkout for Stripe or Cash on Delivery' })
  initiateCheckout(
    @CurrentUser('id') userId: string,
    @Body() dto: InitiateCheckoutDto,
  ) {
    return this.paymentsService.initiateCheckout(userId, dto);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Stripe webhook handler' })
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = (req as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      return { received: false, error: 'No raw body' };
    }
    return this.paymentsService.handleWebhook(rawBody, signature);
  }

  @Get(':orderId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status for an order' })
  getPaymentStatus(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('orderId') orderId: string,
  ) {
    const filterUserId = role === 'ADMIN' ? undefined : userId;
    return this.paymentsService.getPaymentStatus(orderId, filterUserId);
  }

  @Get('session/:sessionId')
  @ApiBearerAuth()
  @Permissions('payments', 'checkout')
  @ApiOperation({ summary: 'Resolve order by Stripe Checkout session' })
  resolveCheckoutSession(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('sessionId') sessionId: string,
  ) {
    const filterUserId = role === 'ADMIN' ? undefined : userId;
    return this.paymentsService.resolveCheckoutSession(sessionId, filterUserId);
  }

  @Post(':orderId/request-refund')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit refund request' })
  requestRefund(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('orderId') orderId: string,
    @Body() dto: RefundRequestDto,
  ) {
    const filterUserId = role === 'ADMIN' ? undefined : userId;
    return this.paymentsService.requestRefund(
      orderId,
      filterUserId,
      dto,
      userId,
    );
  }

  @Post(':orderId/refund')
  @Permissions('order', 'update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund a payment (Admin)' })
  refund(
    @CurrentUser('id') userId: string,
    @Param('orderId') orderId: string,
    @Body() dto: RefundRequestDto,
  ) {
    return this.paymentsService.refund(orderId, dto, userId);
  }
}
