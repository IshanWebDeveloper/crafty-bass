import { Module } from '@nestjs/common';
import { TaxRatesController } from './tax-rates.controller.js';
import { TaxRatesService } from './tax-rates.service.js';

@Module({
  controllers: [TaxRatesController],
  providers: [TaxRatesService],
  exports: [TaxRatesService],
})
export class TaxRatesModule {}
