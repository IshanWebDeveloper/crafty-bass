import { Controller, Get, Param } from '@nestjs/common';
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

  // TODO(Phase C): design the marketplace recommendation surface. For now this
  // exposes the precomputed tradesman recommendations for a job.
  @Get('jobs/:jobId')
  @Permissions('recommendation', 'list')
  @ApiOperation({ summary: 'Get recommended tradesmen for a job (job owner)' })
  getJobRecommendations(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.recommendationsService.getJobRecommendations(userId, jobId);
  }
}
