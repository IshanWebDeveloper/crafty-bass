import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { WebhookEventStatus, type Prisma } from '@repo/db';

const TERMINAL_STATUSES: WebhookEventStatus[] = [
  WebhookEventStatus.IGNORED,
  WebhookEventStatus.PROCESSED,
  WebhookEventStatus.FAILED,
  WebhookEventStatus.REJECTED,
];

/**
 * Reusable audit trail for inbound third-party webhooks (table: WebhookEvent).
 *
 * Usage contract: call `record()` on controller entry to create the RECEIVED
 * row, then `mark()` before every return — including reject paths — so the audit
 * log is always complete.
 *
 * TODO(Phase C): wire this into the marketplace Stripe Connect payout webhook
 * once that controller exists. There is no live consumer yet — the legacy
 * payments webhook was removed in the legacy sweep, and the subscription webhook
 * is handled internally by the @better-auth/stripe plugin.
 */
@Injectable()
export class WebhookEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Persist an inbound webhook on entry; returns the audit row id. */
  async record(input: {
    source: string;
    eventType: string;
    signature?: string | null;
    payload: Prisma.InputJsonValue;
  }): Promise<string> {
    const row = await this.prisma.webhookEvent.create({
      data: {
        source: input.source,
        eventType: input.eventType,
        signature: input.signature ?? null,
        payload: input.payload,
        status: WebhookEventStatus.RECEIVED,
      },
      select: { id: true },
    });
    return row.id;
  }

  /** Transition the audit row's status; stamps processedAt for terminal states. */
  async mark(
    id: string,
    status: WebhookEventStatus,
    options?: { error?: string },
  ): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        error: options?.error ?? null,
        ...(TERMINAL_STATUSES.includes(status)
          ? { processedAt: new Date() }
          : {}),
      },
    });
  }
}
