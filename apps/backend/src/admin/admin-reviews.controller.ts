import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import {
  AdminReviewQueryDto,
  AdminModerateReviewDto,
  AdminDeleteReviewDto,
} from '../reviews/dto/index.js';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('moderation-queue')
  @ApiOperation({ summary: 'List review moderation queue (Admin)' })
  moderationQueue(@Query() query: AdminReviewQueryDto) {
    return this.reviewsService.findAllForAdmin(query);
  }

  @Get()
  @ApiOperation({ summary: 'List all reviews (Admin)' })
  findAll(@Query() query: AdminReviewQueryDto) {
    return this.reviewsService.findAllForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get review details (Admin)' })
  findById(@Param('id') reviewId: string) {
    return this.reviewsService.findByIdForAdmin(reviewId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Moderate any review (Admin)' })
  update(@Param('id') reviewId: string, @Body() dto: AdminModerateReviewDto) {
    return this.reviewsService.updateForAdmin(reviewId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete any review with a reason (Admin)' })
  remove(@Param('id') reviewId: string, @Body() dto: AdminDeleteReviewDto) {
    return this.reviewsService.removeForAdmin(reviewId, dto.reason);
  }
}
