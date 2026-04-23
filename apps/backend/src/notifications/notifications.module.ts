import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { SupportTicketNotificationsListener } from './support-ticket-notifications.listener.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SupportTicketNotificationsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
