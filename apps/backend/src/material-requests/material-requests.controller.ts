import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaterialRequestsService } from './material-requests.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import {
  CreateMaterialRequestDto,
  DeclineMaterialRequestDto,
} from './dto/index.js';

// Mid-job material requests. RBAC reuses the `job` statements (every customer
// has them); the assigned-tradesman / homeowner specifics are enforced in the
// service, matching the repo's "authorization lives in services" approach.
@ApiTags('Material requests')
@ApiBearerAuth()
@Controller()
export class MaterialRequestsController {
  constructor(private readonly service: MaterialRequestsService) {}

  @Post('jobs/:jobId/material-requests')
  @Permissions('job', 'view')
  @ApiOperation({
    summary: 'Request additional materials on a job (assigned tradesman)',
  })
  create(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
    @Body() dto: CreateMaterialRequestDto,
  ) {
    return this.service.create(userId, jobId, dto);
  }

  @Get('jobs/:jobId/material-requests')
  @Permissions('job', 'view')
  @ApiOperation({ summary: 'List material requests for a job' })
  listForJob(@CurrentUser('id') userId: string, @Param('jobId') jobId: string) {
    return this.service.listForJob(userId, jobId);
  }

  @Patch('material-requests/:id/approve')
  @Permissions('job', 'edit')
  @ApiOperation({ summary: 'Approve a material request (homeowner)' })
  approve(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.respond(userId, id, true);
  }

  @Patch('material-requests/:id/decline')
  @Permissions('job', 'edit')
  @ApiOperation({ summary: 'Decline a material request (homeowner)' })
  decline(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: DeclineMaterialRequestDto,
  ) {
    return this.service.respond(userId, id, false, dto.reason);
  }
}
