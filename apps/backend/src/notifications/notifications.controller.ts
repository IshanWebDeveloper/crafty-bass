import { Controller, Get, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

// Per-user notification feed. No `@Permissions` decorator - these endpoints only
// require an authenticated session (the PermissionsGuard treats a route with no
// permission requirement as authenticate-only). Every query is scoped to the
// caller's id in the service, so a user only ever sees/touches their own.
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications (newest first)' })
  list(@CurrentUser('id') userId: string) {
    return this.service.listForUser(userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count my unread notifications' })
  unreadCount(@CurrentUser('id') userId: string) {
    return this.service.unreadCount(userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.service.markAllRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.markRead(userId, id);
  }
}
