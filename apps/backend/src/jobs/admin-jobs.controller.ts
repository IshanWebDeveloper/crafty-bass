import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JobQueryDto } from './dto/index.js';

// Admin/support monitoring surface for jobs. The public `GET /jobs` only lists
// OPEN jobs; this lists every status. Gated on staff roles rather than the
// party-scoped job permissions.
@ApiTags('Admin')
@ApiBearerAuth()
@Roles('ADMIN', 'SUPPORT')
@Controller('admin/jobs')
export class AdminJobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'List all jobs across statuses (Admin/Support)' })
  listAll(@Query() query: JobQueryDto) {
    return this.jobsService.listAllForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a job with moderation context (Admin/Support)',
  })
  findOne(@Param('id') id: string) {
    return this.jobsService.findOneForAdmin(id);
  }
}
