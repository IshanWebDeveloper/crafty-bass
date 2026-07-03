import { Global, Module } from '@nestjs/common';
import { WebhookEventsService } from './webhook-events.service.js';
import { StripeService } from '../common/services/stripe.service.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import { EscrowModule } from '../escrow/escrow.module.js';

/**
 * Provides the reusable WebhookEventsService for any webhook controller to
 * inject, plus the Stripe webhook surface itself. Global so StripeService is
 * available to any module (e.g. EscrowModule) without re-importing.
 */
@Global()
@Module({
  imports: [EscrowModule],
  controllers: [StripeWebhookController],
  providers: [WebhookEventsService, StripeService],
  exports: [WebhookEventsService, StripeService],
})
export class WebhooksModule {}
