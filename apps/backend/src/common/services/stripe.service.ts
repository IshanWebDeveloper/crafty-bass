import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

/**
 * Thin wrapper around the Stripe SDK for real-money escrow collection
 * (card deposits/balances only - see EscrowService). Mirrors EmailService's
 * graceful-degradation pattern: when STRIPE_SECRET_KEY is unset (local/dev
 * without keys configured) methods throw a clear error only when actually
 * called, so the app still boots.
 */
@Injectable()
export class StripeService {
  private readonly stripe?: Stripe;
  private readonly webhookSecret?: string;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    this.stripe = apiKey ? new Stripe(apiKey) : undefined;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  get enabled(): boolean {
    return this.stripe !== undefined;
  }

  private requireClient(): Stripe {
    if (!this.stripe) {
      throw new Error(
        'STRIPE_SECRET_KEY is not configured - cannot perform this Stripe operation.',
      );
    }
    return this.stripe;
  }

  /**
   * Creates a PaymentIntent for a card payment method and confirms it in the
   * same call. Card-only (no redirect-based methods), so no return_url is
   * needed - the intent either succeeds, needs 3DS action, or fails.
   */
  async createAndConfirmPaymentIntent(input: {
    amount: number;
    currency: string;
    paymentMethodId: string;
    metadata: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    return this.requireClient().paymentIntents.create({
      amount: input.amount,
      currency: input.currency,
      payment_method: input.paymentMethodId,
      payment_method_types: ['card'],
      confirm: true,
      metadata: input.metadata,
    });
  }

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.requireClient().paymentIntents.retrieve(id);
  }

  /**
   * Creates a hosted Checkout Session for the deposit. The homeowner is
   * redirected to `session.url` and card details never touch our origin.
   *
   * `escrowId` goes on both the session and the PaymentIntent it creates:
   * checkout.session.completed reads the former, and the latter keeps the
   * PaymentIntent traceable back to the escrow on its own (refunds, disputes).
   */
  async createCheckoutSession(input: {
    amount: number;
    currency: string;
    productName: string;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<Stripe.Checkout.Session> {
    // Wallets are not payment method types: Apple Pay and Google Pay both ride
    // on `card` and have no API enum, and a Checkout Session's `wallet_options`
    // only covers Link. Which wallet the page offers is therefore decided by
    // the account's payment method configuration - ours has apple_pay off and
    // google_pay on. Passing `payment_method_types` would pin the session to
    // manual mode and that configuration would be ignored, so it is only used
    // as the fallback when no configuration id is set.
    const configurationId = process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION_ID;

    return this.requireClient().checkout.sessions.create({
      mode: 'payment',
      ...(configurationId
        ? { payment_method_configuration: configurationId }
        : { payment_method_types: ['card'] }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.amount,
            product_data: { name: input.productName },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: input.metadata,
      payment_intent_data: { metadata: input.metadata },
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    });
  }

  async retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session> {
    return this.requireClient().checkout.sessions.retrieve(id);
  }

  /**
   * Refunds a PaymentIntent. Omit `amount` for a full refund; pass it (in the
   * currency's minor unit) for a partial refund - used by support during dispute
   * mediation to return only part of the deposit.
   */
  async createRefund(input: {
    paymentIntentId: string;
    amount?: number;
  }): Promise<Stripe.Refund> {
    return this.requireClient().refunds.create({
      payment_intent: input.paymentIntentId,
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
    });
  }

  /** Verifies the webhook signature and returns the parsed event, or throws. */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
    }
    return this.requireClient().webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }
}
