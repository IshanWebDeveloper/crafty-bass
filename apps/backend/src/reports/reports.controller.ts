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
import type { Role } from '@repo/db';
import { ReportsService } from './reports.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import {
  CreateReportDto,
  UpdateReportDto,
  ReportQueryDto,
} from './dto/index.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post()
  @Permissions('report', 'create')
  @ApiOperation({
    summary: 'File a report against a user/job/quote/review/message',
  })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReportDto) {
    return this.service.create(userId, dto);
  }

  @Get('mine')
  @Permissions('report', 'view')
  @ApiOperation({ summary: 'List reports the current user has filed' })
  listMine(@CurrentUser('id') userId: string, @Query() query: ReportQueryDto) {
    return this.service.listMine(userId, query);
  }

  @Get()
  @Permissions('report', 'list')
  @ApiOperation({ summary: 'List all reports (moderators / admins)' })
  listAll(@Query() query: ReportQueryDto) {
    return this.service.listAll(query);
  }

  @Get(':id')
  @Permissions('report', 'view')
  @ApiOperation({ summary: 'Get a single report (reporter or moderator)' })
  findOne(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Param('id') id: string,
  ) {
    return this.service.findOne(userId, role, id);
  }

  @Patch(':id')
  @Permissions('report', 'moderate')
  @ApiOperation({
    summary: 'Update a report (status, assignee, resolution notes)',
  })
  update(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.service.update(id, dto);
  }
}
