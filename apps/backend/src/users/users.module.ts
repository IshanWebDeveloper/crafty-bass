import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersCronService } from './users.cron.js';
import { GdprExportProcessor } from './gdpr-export.processor.js';
import { AdminModule } from '../admin/admin.module.js';

@Module({
  imports: [AdminModule, BullModule.registerQueue({ name: 'gdpr-export' })],
  controllers: [UsersController],
  providers: [UsersService, UsersCronService, GdprExportProcessor],
  exports: [UsersService],
})
export class UsersModule {}
