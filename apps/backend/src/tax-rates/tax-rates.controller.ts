import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateTaxRateDto, UpdateTaxRateDto } from './dto/index.js';
import { TaxRatesService } from './tax-rates.service.js';

@ApiTags('Tax Rates')
@Controller('tax-rates')
export class TaxRatesController {
  constructor(private readonly taxRatesService: TaxRatesService) {}

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Get active tax rate' })
  getActiveTaxRate() {
    return this.taxRatesService.findActive();
  }

  @Get()
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List tax rates (Admin)' })
  listTaxRates() {
    return this.taxRatesService.list();
  }

  @Post()
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create tax rate (Admin)' })
  createTaxRate(@Body() dto: CreateTaxRateDto) {
    return this.taxRatesService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update tax rate (Admin)' })
  updateTaxRate(@Param('id') id: string, @Body() dto: UpdateTaxRateDto) {
    return this.taxRatesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete tax rate (Admin)' })
  async deleteTaxRate(@Param('id') id: string) {
    await this.taxRatesService.remove(id);
    return { message: 'Tax rate deleted' };
  }
}
