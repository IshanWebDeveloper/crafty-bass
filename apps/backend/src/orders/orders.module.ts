import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { CouponValidationEngine } from './coupon-validation.engine.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { PromotionRuleEngine } from './promotion-rule.engine.js';

@Module({
  imports: [PromotionsModule],
  controllers: [OrdersController],
  providers: [OrdersService, CouponValidationEngine, PromotionRuleEngine],
  exports: [OrdersService],
})
export class OrdersModule {}
