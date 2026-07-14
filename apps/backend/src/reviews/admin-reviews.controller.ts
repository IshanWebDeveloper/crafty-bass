import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  AdminReviewQueryDto,
  AdminModerateReviewDto,
  AdminDeleteReviewDto,
} from './dto/index.js';

// Admin moderation surface for reviews. The ReviewsService already had the
// admin methods; this controller exposes them. Gated ADMIN-only to match the
// review:moderate capability being admin-tier.
@ApiTags('Admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List all reviews for moderation (Admin)' })
  findAll(@Query() query: AdminReviewQueryDto) {
    return this.reviewsService.findAllForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a review detail (Admin)' })
  findOne(@Param('id') id: string) {
    return this.reviewsService.findByIdForAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Moderate a review - hide/unhide or edit (Admin)' })
  update(@Param('id') id: string, @Body() dto: AdminModerateReviewDto) {
    return this.reviewsService.updateForAdmin(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review with a reason (Admin)' })
  remove(@Param('id') id: string, @Body() dto: AdminDeleteReviewDto) {
    return this.reviewsService.removeForAdmin(id, dto.reason);
  }
}
