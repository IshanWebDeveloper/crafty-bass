import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  DateRangeQueryDto,
  AuditLogQueryDto,
  AdminCreateUserDto,
  AdminPromotionListQueryDto,
  CreatePromotionDto,
  UpdatePromotionDto,
} from './dto/index.js';
import { Role } from '@repo/db';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard overview' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('reports/sales')
  @ApiOperation({ summary: 'Sales report' })
  getSalesReport(@Query() query: DateRangeQueryDto) {
    return this.adminService.getSalesReport(query);
  }

  @Get('reports/sales/download')
  @ApiOperation({
    summary: 'Generate and download sales report as PDF (async)',
  })
  downloadSalesReport(
    @CurrentUser('id') userId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.adminService.downloadSalesReport(userId, query);
  }

  @Get('reports/products')
  @ApiOperation({
    summary: 'Product report (top selling, most reviewed, low stock)',
  })
  getProductReport() {
    return this.adminService.getProductReport();
  }

  @Get('reports/users')
  @ApiOperation({ summary: 'User activity report' })
  getUserReport() {
    return this.adminService.getUserReport();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details' })
  getUserById(@Param('id') userId: string) {
    return this.adminService.getUserById(userId);
  }

  @Get('promotions')
  @ApiOperation({ summary: 'List promotions (Admin)' })
  listPromotions(@Query() query: AdminPromotionListQueryDto) {
    return this.adminService.listPromotions(query);
  }

  @Get('promotions/:id')
  @ApiOperation({ summary: 'Get promotion details (Admin)' })
  findPromotionById(@Param('id') promotionId: string) {
    return this.adminService.findPromotionById(promotionId);
  }

  @Post('promotions')
  @ApiOperation({ summary: 'Create promotion (Admin)' })
  createPromotion(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.adminService.createPromotion(adminId, dto);
  }

  @Patch('promotions/:id')
  @ApiOperation({ summary: 'Update promotion (Admin)' })
  updatePromotion(
    @CurrentUser('id') adminId: string,
    @Param('id') promotionId: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.adminService.updatePromotion(adminId, promotionId, dto);
  }

  @Delete('promotions/:id')
  @ApiOperation({ summary: 'Deactivate promotion (Admin)' })
  deactivatePromotion(
    @CurrentUser('id') adminId: string,
    @Param('id') promotionId: string,
  ) {
    return this.adminService.deactivatePromotion(adminId, promotionId);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Audit trail' })
  getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.adminService.getAuditLogs(query);
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
