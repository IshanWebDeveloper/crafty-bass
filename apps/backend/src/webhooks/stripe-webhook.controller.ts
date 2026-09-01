import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { ApiExcludeController } from '@nestjs/swagger';
import { WebhookEventStatus, type Prisma } from '@repo/db';
import { StripeService } from '../common/services/stripe.service.js';
import { WebhookEventsService } from './webhook-events.service.js';
import { EscrowService } from '../escrow/escrow.service.js';
import { Public } from '../common/decorators/public.decorator.js';

// Path matches the existing `stripe:listen` root package.json script
// (`stripe listen --forward-to http://localhost:3005/api/v1/payments/webhook`).
// Escrow collection only (see EscrowService) - payment_intent events are the
// only ones handled; everything else is recorded and ignored.
@ApiExcludeController()
@Controller('payments/webhook')
export class StripeWebhookController {
  constructor(
    private readonly stripe: StripeService,
    private readonly webhookEvents: WebhookEventsService,
    private readonly escrow: EscrowService,
  ) {}

  // Stripe (not a session) is the caller - the signature check below is the
  // real auth, so this bypasses PermissionsGuard's session requirement.
  @Public()
  @Post()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Missing Stripe signature or body');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const eventId = await this.webhookEvents.record({
      source: 'stripe',
      eventType: event.type,
      signature,
      payload: event as unknown as Prisma.InputJsonValue,
    });

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          // Hosted Checkout is the card funding path: this is what actually
          // marks the deposit funded. The redirect back to the job page is
          // cosmetic and is never trusted for this.
          await this.escrow.confirmFundedByCheckoutSession(event.data.object);
          await this.webhookEvents.mark(eventId, WebhookEventStatus.PROCESSED);
          break;
        }
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          await this.escrow.confirmFundedByPaymentIntent(paymentIntent.id);
          await this.webhookEvents.mark(eventId, WebhookEventStatus.PROCESSED);
          break;
        }
        case 'payment_intent.payment_failed': {
          // Escrow stays REQUESTED so the homeowner can retry funding.
          await this.webhookEvents.mark(eventId, WebhookEventStatus.PROCESSED);
          break;
        }
        default:
          await this.webhookEvents.mark(eventId, WebhookEventStatus.IGNORED);
      }
    } catch (error) {
      await this.webhookEvents.mark(eventId, WebhookEventStatus.FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    return { received: true };
  }
}
