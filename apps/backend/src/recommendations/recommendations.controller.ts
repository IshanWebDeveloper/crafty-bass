import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get personalized product recommendations' })
  getRecommendations(@CurrentUser('id') userId: string) {
    return this.recommendationsService.getRecommendations(userId);
  }
}
