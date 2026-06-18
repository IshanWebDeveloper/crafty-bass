import { Controller, Get, Patch, Body, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { UpdateProfileDto, UserListQueryDto } from './dto/index.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get('me/dashboard')
  @ApiOperation({ summary: 'Get personalised dashboard' })
  getDashboard(@CurrentUser('id') userId: string) {
    return this.usersService.getDashboard(userId);
  }

  @Get()
  @Permissions('user', 'list')
  @ApiOperation({ summary: 'List all users (Admin only)' })
  listUsers(@Query() query: UserListQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Get('me/export')
  @ApiOperation({
    summary: 'Export all user data as a ZIP file containing JSON',
  })
  exportData(@CurrentUser('id') userId: string) {
    return this.usersService.exportData(userId);
  }

  @Get('me/gdpr-exports/latest/download-url')
  @ApiOperation({
    summary:
      'Mint a short-lived presigned URL for the most recent GDPR data export',
  })
  getLatestExportDownloadUrl(@CurrentUser('id') userId: string) {
    return this.usersService.getLatestExportDownloadUrl(userId);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Schedule the current user account for deletion' })
  scheduleDeletion(@CurrentUser('id') userId: string) {
    return this.usersService.scheduleDeletion(userId);
  }
}
