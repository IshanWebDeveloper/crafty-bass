import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EscrowService } from './escrow.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { FundEscrowDto } from './dto/index.js';

@ApiTags('Escrow')
@ApiBearerAuth()
@Controller()
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get('jobs/:jobId/escrow')
  @Permissions('escrow', 'view')
  @ApiOperation({ summary: 'Get the materials-deposit escrow for a job' })
  getForJob(@CurrentUser('id') userId: string, @Param('jobId') jobId: string) {
    return this.escrowService.getForJob(userId, jobId);
  }

  @Get('escrows/:id')
  @Permissions('escrow', 'view')
  @ApiOperation({ summary: 'Get an escrow by id (party only)' })
  getById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.escrowService.getById(userId, id);
  }

  @Post('escrows/:id/fund')
  @Permissions('escrow', 'fund')
  @ApiOperation({ summary: 'Fund the deposit into escrow (homeowner)' })
  fund(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: FundEscrowDto,
  ) {
    return this.escrowService.fund(userId, id, dto);
  }

  @Post('escrows/:id/release-materials')
  @Permissions('escrow', 'release')
  @ApiOperation({ summary: 'Start work and release the deposit (tradesman)' })
  releaseMaterials(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.escrowService.releaseMaterials(userId, id);
  }

  @Post('escrows/:id/work-done')
  @Permissions('escrow', 'release')
  @ApiOperation({ summary: 'Mark the work complete (tradesman)' })
  markWorkDone(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.escrowService.markWorkDone(userId, id);
  }

  @Post('escrows/:id/approve')
  @Permissions('escrow', 'approve')
  @ApiOperation({
    summary: 'Approve the work and release the balance (homeowner)',
  })
  approve(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.escrowService.approve(userId, id);
  }

  @Post('escrows/:id/refund')
  @Permissions('escrow', 'refund')
  @ApiOperation({ summary: 'Refund a funded deposit before work starts' })
  refund(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.escrowService.refund(userId, id);
  }
}
