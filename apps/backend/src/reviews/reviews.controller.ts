import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewQueryDto,
} from './dto/index.js';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('jobs/:jobId/reviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a review for a job counterparty' })
  create(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(userId, jobId, dto);
  }

  @Public()
  @Get('jobs/:jobId/reviews')
  @ApiOperation({ summary: 'List public reviews for a job' })
  findForJob(@Param('jobId') jobId: string, @Query() query: ReviewQueryDto) {
    return this.reviewsService.findForJob(jobId, query);
  }

  @Patch('reviews/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit own review' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(userId, reviewId, dto);
  }

  @Delete('reviews/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete own review' })
  remove(@CurrentUser('id') userId: string, @Param('id') reviewId: string) {
    return this.reviewsService.remove(userId, reviewId);
  }
}
