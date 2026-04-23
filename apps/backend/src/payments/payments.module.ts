import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { CouponValidationEngine } from '../orders/coupon-validation.engine.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { PromotionRuleEngine } from '../orders/promotion-rule.engine.js';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    OrdersService,
    CouponValidationEngine,
    PromotionsService,
    PromotionRuleEngine,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
