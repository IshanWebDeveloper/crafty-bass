import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { ClassificationService } from './classification.service.js';
import { ClassifyJobDto } from './dto/index.js';

@ApiTags('Classification')
@ApiBearerAuth()
@Controller('classify')
export class ClassificationController {
  constructor(private readonly classificationService: ClassificationService) {}

  // Authenticated-only (no @Permissions): any signed-in user drafting a job may
  // ask the classifier to suggest a category and skills for their description.
  @Post('job')
  @ApiOperation({ summary: 'Suggest a category and skills for a job draft' })
  classifyJob(@Body() dto: ClassifyJobDto, @Req() req: Request) {
    return this.classificationService.classifyJob(dto, req.headers);
  }
}
