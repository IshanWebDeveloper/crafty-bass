import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Sse,
  MessageEvent,
  Redirect,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import {
  CouponQueryDto,
  CreateOrderDto,
  CreateCouponDto,
  UpdateCouponDto,
  UpdateOrderStatusDto,
  OrderQueryDto,
  ValidateCouponDto,
} from './dto/index.js';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Checkout — create order from cart' })
  checkout(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    return this.ordersService.checkout(userId, dto);
  }

  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validate coupon against current cart' })
  validateCoupon(
    @CurrentUser('id') userId: string,
    @Body() dto: ValidateCouponDto,
  ) {
    return this.ordersService.validateCoupon(userId, dto);
  }

  @Post('coupons')
  @Permissions('coupon', 'create')
  @ApiOperation({ summary: 'Create coupon (Admin)' })
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.ordersService.createCoupon(dto);
  }

  @Get('coupons')
  @Permissions('coupon', 'list')
  @ApiOperation({ summary: 'List coupons (Admin)' })
  listCoupons(@Query() query: CouponQueryDto) {
    return this.ordersService.listCoupons(query);
  }

  @Get('coupons/:couponId')
  @Permissions('coupon', 'view')
  @ApiOperation({ summary: 'Get coupon details (Admin)' })
  findCouponById(@Param('couponId') couponId: string) {
    return this.ordersService.findCouponById(couponId);
  }

  @Patch('coupons/:couponId')
  @Permissions('coupon', 'update')
  @ApiOperation({ summary: 'Update coupon (Admin)' })
  updateCoupon(
    @Param('couponId') couponId: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.ordersService.updateCoupon(couponId, dto);
  }

  @Delete('coupons/:couponId')
  @Permissions('coupon', 'delete')
  @ApiOperation({ summary: 'Deactivate coupon (Admin)' })
  deactivateCoupon(@Param('couponId') couponId: string) {
    return this.ordersService.deactivateCoupon(couponId);
  }

  @Get()
  @ApiOperation({ summary: 'List my orders' })
  findMyOrders(
    @CurrentUser('id') userId: string,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.findUserOrders(userId, query);
  }

  @Get('all')
  @Permissions('order', 'list')
  @ApiOperation({ summary: 'List all orders (Admin)' })
  findAllOrders(@Query() query: OrderQueryDto) {
    return this.ordersService.findAllOrders(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details' })
  findById(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') orderId: string,
  ) {
    // Admin can see any order; customers only see their own
    const filterUserId = role === 'ADMIN' ? undefined : userId;
    return this.ordersService.findById(orderId, filterUserId);
  }

  @Get(':id/invoice')
  @ApiOperation({ summary: 'Generate invoice and redirect to download URL' })
  @Redirect()
  async downloadInvoice(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') orderId: string,
  ) {
    const filterUserId = role === 'ADMIN' ? undefined : userId;
    const url = await this.ordersService.getInvoiceDownloadUrl(
      orderId,
      filterUserId,
    );

    return { url };
  }

  @Sse(':id/tracking')
  @ApiOperation({ summary: 'Real-time order tracking stream (SSE)' })
  @Permissions('order', 'view')
  async trackOrder(
    @Param('id') orderId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<Observable<MessageEvent>> {
    await this.ordersService.assertCanTrackOrder(orderId, userId, role);
    return this.ordersService.trackOrder(orderId);
  }

  @Patch(':id/status')
  @Permissions('order', 'update')
  @ApiOperation({ summary: 'Update order status (Admin)' })
  updateStatus(
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(orderId, dto);
  }
}
