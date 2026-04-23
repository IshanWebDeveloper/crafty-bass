import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service.js';
import {
  SUPPORT_TICKET_MESSAGE_ADDED_EVENT,
  SUPPORT_TICKET_STATUS_CHANGED_EVENT,
  type SupportTicketMessageAddedEvent,
  type SupportTicketStatusChangedEvent,
} from '../support/support.events.js';

@Injectable()
export class SupportTicketNotificationsListener {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(SUPPORT_TICKET_MESSAGE_ADDED_EVENT)
  async handleTicketMessageAdded(event: SupportTicketMessageAddedEvent) {
    const shortTicketId = event.ticketId.slice(0, 8);
    const messagePreview =
      event.messageBody.length > 120
        ? `${event.messageBody.slice(0, 117)}...`
        : event.messageBody;

    const staffIds = await this.notificationsService.getUserIdsByRoles([
      'ADMIN',
      'SUPPORT',
    ]);

    const recipientIds = [
      event.customerId,
      event.assignedToId ?? '',
      ...staffIds,
    ];

    await this.notificationsService.createForUsers(
      recipientIds.filter((recipientId) => recipientId !== event.senderId),
      'TICKET_UPDATE',
      `New support message on ticket #${shortTicketId}`,
      `${event.senderName} replied to "${event.ticketSubject}". ${messagePreview}`,
    );
  }

  @OnEvent(SUPPORT_TICKET_STATUS_CHANGED_EVENT)
  async handleTicketStatusChanged(event: SupportTicketStatusChangedEvent) {
    const shortTicketId = event.ticketId.slice(0, 8);

    const staffIds = await this.notificationsService.getUserIdsByRoles([
      'ADMIN',
      'SUPPORT',
    ]);

    const recipientIds = [
      event.customerId,
      event.assignedToId ?? '',
      ...staffIds,
    ].filter((recipientId) => recipientId !== event.changedById);

    await this.notificationsService.createForUsers(
      recipientIds,
      'TICKET_UPDATE',
      `Ticket #${shortTicketId} status updated`,
      `"${event.ticketSubject}" changed from ${event.previousStatus} to ${event.currentStatus}.`,
    );
  }
}
