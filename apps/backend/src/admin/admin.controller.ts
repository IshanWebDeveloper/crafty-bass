import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminCreateUserDto, AuditLogQueryDto } from './dto/index.js';
import { Role } from '@repo/db';

// TODO(Phase C): rebuild the marketplace admin dashboard/reports surface. The
// legacy e-commerce dashboard, sales/product reports, promotions, and audit-log
// routes were removed with their models during the legacy sweep.
@ApiTags('Admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Moderators (SUPPORT) also need the dashboard KPIs, so this route widens the
  // class-level ADMIN-only guard. Handler-level @Roles overrides the class.
  @Get('metrics')
  @Roles('ADMIN', 'SUPPORT')
  @ApiOperation({ summary: 'Aggregated platform metrics for the dashboard' })
  getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'List admin action audit trail' })
  listAuditLog(@Query() query: AuditLogQueryDto) {
    return this.adminService.listAuditLog(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details' })
  getUserById(@Param('id') userId: string) {
    return this.adminService.getUserById(userId);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create user' })
  createUser(
    @CurrentUser('id') adminId: string,
    @Body() body: AdminCreateUserDto,
    @Headers() headers: HeadersInit,
  ) {
    return this.adminService.createUser(adminId, body, headers);
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: 'Ban user' })
  banUser(
    @CurrentUser('id') adminId: string,
    @Headers() headers: HeadersInit,
    @Param('id') userId: string,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.banUser(adminId, userId, reason, headers);
  }

  @Post('users/:id/unban')
  @ApiOperation({ summary: 'Unban user' })
  unbanUser(
    @CurrentUser('id') adminId: string,
    @Headers() headers: HeadersInit,
    @Param('id') userId: string,
  ): Promise<{ message: string }> {
    return this.adminService.unbanUser(adminId, userId, headers);
  }

  @Post('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  updateUserRole(
    @CurrentUser('id') adminId: string,
    @Param('id') targetUserId: string,
    @Body('role') newRole: Role,
    @Headers() headers: HeadersInit,
  ) {
    return this.adminService.updateUserRole(
      adminId,
      targetUserId,
      newRole,
      headers,
    );
  }
}
