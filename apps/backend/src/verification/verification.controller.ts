import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VerificationService } from './verification.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { SubmitVerificationDto, RejectVerificationDto } from './dto/index.js';

@ApiTags('Verification')
@ApiBearerAuth()
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post()
  @Permissions('profile', 'edit')
  @ApiOperation({ summary: 'Submit (or resubmit) tradesman verification' })
  submit(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.verificationService.submit(userId, dto);
  }

  @Get('me')
  @Permissions('profile', 'view')
  @ApiOperation({ summary: 'Get my verification submission and status' })
  getMine(@CurrentUser('id') userId: string) {
    return this.verificationService.getMine(userId);
  }

  @Get('pending')
  @Permissions('profile', 'verify')
  @ApiOperation({ summary: 'List pending verifications (reviewer)' })
  listPending(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.verificationService.listPending(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get(':id')
  @Permissions('profile', 'verify')
  @ApiOperation({ summary: 'Get a verification submission detail (reviewer)' })
  getById(@Param('id') id: string) {
    return this.verificationService.getById(id);
  }

  @Get(':id/documents')
  @Permissions('profile', 'verify')
  @ApiOperation({
    summary: 'Get short-lived signed URLs for a submission’s documents',
  })
  getDocuments(@Param('id') id: string) {
    return this.verificationService.getDocuments(id);
  }

  @Post(':id/approve')
  @Permissions('profile', 'verify')
  @ApiOperation({ summary: 'Approve a verification (reviewer)' })
  approve(@CurrentUser('id') reviewerId: string, @Param('id') id: string) {
    return this.verificationService.approve(reviewerId, id);
  }

  @Post(':id/reject')
  @Permissions('profile', 'verify')
  @ApiOperation({ summary: 'Reject a verification (reviewer)' })
  reject(
    @CurrentUser('id') reviewerId: string,
    @Param('id') id: string,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.verificationService.reject(reviewerId, id, dto);
  }
}
