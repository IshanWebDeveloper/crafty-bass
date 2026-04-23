export const SUPPORT_TICKET_MESSAGE_ADDED_EVENT =
  'support.ticket.message.added';
export const SUPPORT_TICKET_STATUS_CHANGED_EVENT =
  'support.ticket.status.changed';

export interface SupportTicketMessageAddedEvent {
  ticketId: string;
  customerId: string;
  assignedToId?: string | null;
  ticketSubject: string;
  senderId: string;
  senderName: string;
  messageBody: string;
}

export interface SupportTicketStatusChangedEvent {
  ticketId: string;
  customerId: string;
  assignedToId?: string | null;
  changedById?: string;
  ticketSubject: string;
  previousStatus: string;
  currentStatus: string;
}
