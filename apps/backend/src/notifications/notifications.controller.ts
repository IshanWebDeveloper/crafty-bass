import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import {
  AdminCreateNotificationDto,
  AdminNotificationQueryDto,
} from './dto/index.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create notification for a specific user (Admin)' })
  createForUser(@Body() dto: AdminCreateNotificationDto) {
    return this.notificationsService.createForUser(
      dto.userId,
      dto.type,
      dto.title,
      dto.body,
    );
  }

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List notifications across users (Admin)' })
  listForAdmin(@Query() query: AdminNotificationQueryDto) {
    return this.notificationsService.listForAdmin(
      query.userId,
      query.page,
      query.limit,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  list(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.list(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }
}
