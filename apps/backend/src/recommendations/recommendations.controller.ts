import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service.js';

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
  @ApiOperation({ summary: 'Get recommended tradesmen for a job' })
  getJobRecommendations(@Param('jobId') jobId: string) {
    return this.recommendationsService.getJobRecommendations(jobId);
  }
}
