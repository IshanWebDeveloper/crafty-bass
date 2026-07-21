import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';

@ApiTags('Recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('jobs/:jobId')
  @Permissions('recommendation', 'list')
  @ApiOperation({ summary: 'Get recommended tradesmen for a job (job owner)' })
  getJobRecommendations(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.recommendationsService.getJobRecommendations(userId, jobId);
  }

  @Post('jobs/:jobId/refresh')
  @Permissions('recommendation', 'list')
  @ApiOperation({
    summary: 'Recompute the recommended tradesmen for a job (job owner)',
  })
  refreshJobRecommendations(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.recommendationsService.refreshJobRecommendations(userId, jobId);
  }
}
