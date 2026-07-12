import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Custom ThrottlerGuard that:
 * 1. Reads the real client IP from X-Forwarded-For when behind a proxy.
 * 2. Sets a Retry-After header (in seconds) on 429 responses.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);

  /**
   * Use the first address from X-Forwarded-For if present,
   * falling back to the socket remote address.
   */
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<
      string,
      string | string[] | undefined
    >;
    const forwarded = headers['x-forwarded-for'] as string | undefined;
    const ip =
      forwarded?.split(',')[0]?.trim() ??
      (req.ip as string | undefined) ??
      'unknown';
    return Promise.resolve(ip);
  }

  /**
   * Override to attach Retry-After header before throwing the 429 error.
   */
  protected throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: {
      limit: number;
      ttl: number;
      key: string;
      tracker: string;
      totalHits: number;
      timeToExpire: number;
      isBlocked: boolean;
      timeToBlockExpire: number;
    },
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();

    // timeToExpire is in milliseconds - convert to whole seconds
    const retryAfterSeconds = Math.ceil(
      throttlerLimitDetail.timeToExpire / 1000,
    );
    res.setHeader('Retry-After', String(retryAfterSeconds));

    this.logger.warn(
      `Rate limit exceeded for ${throttlerLimitDetail.tracker} - ` +
        `${throttlerLimitDetail.totalHits}/${throttlerLimitDetail.limit} hits, ` +
        `retry in ${retryAfterSeconds}s`,
    );

    throw new ThrottlerException(
      `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
    );
  }
}
