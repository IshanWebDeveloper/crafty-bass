import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

/**
 * Thin wrapper around Resend for transactional email sent from the backend
 * (better-auth handles its own auth emails in `@repo/auth`; this covers
 * everything else - e.g. job-expiry notices).
 *
 * Mirrors the auth package's graceful degradation: when `RESEND_API_KEY` is
 * unset (the usual local/dev case) it logs instead of throwing, so features that
 * send email still work end-to-end without a provider configured. Sends are
 * best-effort - `send` never throws; it returns whether the mail went out.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend?: Resend;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : undefined;
    this.from =
      process.env.RESEND_FROM_EMAIL ?? 'Crafty Bass <onboarding@resend.dev>';
  }

  /** Whether a Resend API key is configured (real sends will be attempted). */
  get enabled(): boolean {
    return this.resend !== undefined;
  }

  /**
   * Sends one email. Returns `true` when it was dispatched, `false` when skipped
   * (no API key) or the provider call failed - callers treat email as a
   * best-effort side channel and don't fail the request when it doesn't send.
   */
  async send({ to, subject, html }: SendEmailOptions): Promise<boolean> {
    const recipients = Array.isArray(to) ? to.join(', ') : to;

    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY not configured - skipped email "${subject}" to ${recipients}.`,
      );
      return false;
    }

    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email "${subject}" to ${recipients}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
