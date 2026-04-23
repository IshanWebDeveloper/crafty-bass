import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/index.js';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Get all currently active promotions' })
  getActivePromotions() {
    return this.promotionsService.getActivePromotions();
  }

  @Get('eligible')
  @ApiOperation({ summary: 'List promotions eligible for the current user' })
  listEligiblePromotions(@CurrentUser('id') userId: string) {
    return this.promotionsService.listEligiblePromotionsByUserId(userId);
  }

  @Get('check-eligibility/:code')
  @ApiOperation({
    summary: 'Check if user is eligible for a specific promotion',
  })
  checkEligibility(
    @CurrentUser('id') userId: string,
    @Param('code') promotionCode: string,
  ) {
    return this.promotionsService.checkUserEligibility(userId, promotionCode);
  }
}
