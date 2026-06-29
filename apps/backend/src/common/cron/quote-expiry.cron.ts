import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Lapses PENDING quotes whose `validUntil` has passed to EXPIRED, so a homeowner
 * can't accept a stale price. `validUntil` is set from the tradesman's chosen
 * validity window when the quote is submitted. Runs hourly.
 */
@Injectable()
export class QuoteExpiryCronService {
  private readonly logger = new Logger(QuoteExpiryCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireLapsedQuotes() {
    const result = await this.prisma.quote.updateMany({
      where: { status: 'PENDING', validUntil: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} lapsed quote(s).`);
    }
  }
}
