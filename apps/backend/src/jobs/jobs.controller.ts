import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CreateJobDto, JobQueryDto, UpdateJobDto } from './dto/index.js';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @Permissions('job', 'create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Post a job (homeowner)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateJobDto) {
    return this.jobsService.create(userId, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse open jobs' })
  browse(@Query() query: JobQueryDto) {
    return this.jobsService.browse(query);
  }

  // Declared before ':id' so "mine" is not captured as a job id.
  @Get('mine')
  @Permissions('job', 'list')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current homeowner's jobs" })
  findMine(@CurrentUser('id') userId: string, @Query() query: JobQueryDto) {
    return this.jobsService.findMine(userId, query);
  }

  // Declared before ':id' so "stats" is not captured as a job id.
  @Public()
  @Get('stats')
  @ApiOperation({ summary: 'Public marketplace counts for the landing page' })
  stats() {
    return this.jobsService.publicStats();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a job by id' })
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Get(':id/agreement')
  @Permissions('job', 'view')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the agreed terms for an assigned job (parties only)',
  })
  findAgreement(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.jobsService.findAgreement(userId, id);
  }

  @Patch(':id')
  @Permissions('job', 'edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit own open job (homeowner)' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(userId, id, dto);
  }

  @Patch(':id/cancel')
  @Permissions('job', 'cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel own job' })
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.jobsService.cancel(userId, id);
  }
}
