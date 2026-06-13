import { Global, Module } from '@nestjs/common';
import { WebhookEventsService } from './webhook-events.service.js';

/**
 * Provides the reusable WebhookEventsService for any webhook controller to
 * inject. Global so future webhook surfaces (e.g. Stripe Connect payouts) can
 * record an audit trail without re-importing.
 */
@Global()
@Module({
  providers: [WebhookEventsService],
  exports: [WebhookEventsService],
})
export class WebhooksModule {}
