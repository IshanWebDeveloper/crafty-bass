import { Module } from '@nestjs/common';
import { MaterialRequestsController } from './material-requests.controller.js';
import { MaterialRequestsService } from './material-requests.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [MaterialRequestsController],
  providers: [MaterialRequestsService],
  exports: [MaterialRequestsService],
})
export class MaterialRequestsModule {}
