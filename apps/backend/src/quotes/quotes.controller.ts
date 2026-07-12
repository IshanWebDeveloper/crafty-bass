import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuotesService } from './quotes.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { CreateQuoteDto } from './dto/index.js';

@ApiTags('Quotes')
@ApiBearerAuth()
@Controller()
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post('jobs/:jobId/quotes')
  @Permissions('quote', 'create')
  @ApiOperation({ summary: 'Submit a quote on a job (tradesman)' })
  create(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotesService.create(userId, jobId, dto);
  }

  @Get('jobs/:jobId/quotes')
  @Permissions('quote', 'list')
  @ApiOperation({ summary: 'List quotes for a job (job owner)' })
  listForJob(@CurrentUser('id') userId: string, @Param('jobId') jobId: string) {
    return this.quotesService.listForJob(userId, jobId);
  }

  @Get('quotes/mine')
  @Permissions('quote', 'list')
  @ApiOperation({ summary: 'List quotes I have submitted (tradesman)' })
  listMine(@CurrentUser('id') userId: string) {
    return this.quotesService.listMine(userId);
  }

  @Patch('quotes/:id')
  @Permissions('quote', 'edit')
  @ApiOperation({ summary: 'Edit own pending quote (tradesman)' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotesService.update(userId, id, dto);
  }

  @Patch('quotes/:id/accept')
  @Permissions('quote', 'accept')
  @ApiOperation({ summary: 'Accept a quote (job owner → assigns the job)' })
  accept(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.quotesService.accept(userId, id);
  }

  @Patch('quotes/:id/reject')
  @Permissions('quote', 'reject')
  @ApiOperation({ summary: 'Reject a quote (job owner)' })
  reject(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.quotesService.reject(userId, id);
  }

  @Patch('quotes/:id/withdraw')
  @Permissions('quote', 'withdraw')
  @ApiOperation({ summary: 'Withdraw own pending quote (tradesman)' })
  withdraw(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.quotesService.withdraw(userId, id);
  }
}
