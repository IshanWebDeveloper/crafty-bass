import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller.js';
import { AdminEscrowController } from './admin-escrow.controller.js';
import { EscrowService } from './escrow.service.js';
import { EscrowInvoiceService } from './escrow-invoice.service.js';
import { EmailService } from '../common/services/email.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [EscrowController, AdminEscrowController],
  providers: [EscrowService, EscrowInvoiceService, EmailService],
  exports: [EscrowService],
})
export class EscrowModule {}
