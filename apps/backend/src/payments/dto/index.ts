import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaymentMethodSchema } from '@repo/shared-types';

// ─── Initiate Checkout ──────────────────────────────────────────────────────

const InitiateCheckoutSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: PaymentMethodSchema.optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export class InitiateCheckoutDto extends createZodDto(InitiateCheckoutSchema) {}

// ─── Refund Request ─────────────────────────────────────────────────────────

const RefundRequestSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export class RefundRequestDto extends createZodDto(RefundRequestSchema) {}
