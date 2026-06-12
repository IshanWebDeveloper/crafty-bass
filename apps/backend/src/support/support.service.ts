import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { TicketStatus, TicketPriority } from '@repo/db';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { buildPaginationMeta } from '../common/dto/pagination.dto.js';
import {
  SUPPORT_TICKET_MESSAGE_ADDED_EVENT,
  SUPPORT_TICKET_STATUS_CHANGED_EVENT,
} from './support.events.js';
import type {
  CreateTicketDto,
  AddMessageDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  TicketQueryDto,
  RequestReturnApprovalDto,
  ReviewReturnApprovalDto,
} from './dto/index.js';

const RETURN_SUBJECT_KEYWORDS = [
  'return',
  'refund',
  'exchange',
  'replacement',
  'replace',
];

const RETURN_APPROVAL_REQUEST_MARKER =
  'Support has requested admin approval to complete this return process.';

function isReturnTicketSubject(subject: string) {
  const normalized = subject.toLowerCase();
  return RETURN_SUBJECT_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );
}

function extractOptionalNote(body: string) {
  const noteMarker = 'Note:';
  const markerIndex = body.indexOf(noteMarker);

  if (markerIndex < 0) {
    return null;
  }

  const note = body.slice(markerIndex + noteMarker.length).trim();
  return note.length > 0 ? note : null;
}

function getApprovalEventType(body: string) {
  if (body.includes('Admin approved return completion.')) {
    return 'APPROVED' as const;
  }

  if (
    body.includes(
      'Admin rejected return completion request and sent it back to support.',
    )
  ) {
    return 'REJECTED' as const;
  }

  return 'REQUESTED' as const;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async notifyAdmins(title: string, body: string) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (admins.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'TICKET_UPDATE',
        title,
        body,
      })),
    });
  }

  private async createTicketUpdateNotificationForUsers(
    userIds: string[],
    title: string,
    body: string,
  ) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueUserIds.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        type: 'TICKET_UPDATE',
        title,
        body,
      })),
    });
  }

  async createTicket(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject,
        category: dto.category,
        priority: dto.priority as TicketPriority,
        orderId: dto.orderId ?? null,
        messages: {
          create: { senderId: userId, body: dto.body },
        },
      },
      include: { messages: true },
    });
  }

  async listTickets(userId: string, role: string, query: TicketQueryDto) {
    const { page, limit, status, priority } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (role === 'CUSTOMER') where.userId = userId;
    if (status) where.status = status as TicketStatus;
    if (priority) where.priority = priority as TicketPriority;

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          agent: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data: tickets, meta: buildPaginationMeta(total, page, limit) };
  }

  async getTicket(ticketId: string, userId: string, role: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        agent: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            status: true,
            subtotalAmount: true,
            discountAmount: true,
            taxAmount: true,
            totalAmount: true,
            trackingNumber: true,
            payment: {
              select: {
                status: true,
                method: true,
                amount: true,
                transactionId: true,
              },
            },
            items: {
              select: {
                id: true,
                quantity: true,
                unitPrice: true,
                variant: {
                  select: {
                    sku: true,
                    product: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, name: true, role: true } } },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    if (role === 'CUSTOMER' && ticket.userId !== userId) {
      throw new ForbiddenException('Not your ticket');
    }

    return ticket;
  }

  async addMessage(
    ticketId: string,
    senderId: string,
    senderRole: string,
    dto: AddMessageDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        userId: true,
        assignedToId: true,
        subject: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (senderRole === 'CUSTOMER' && ticket.userId !== senderId) {
      throw new ForbiddenException('Not your ticket');
    }

    if (
      senderRole === 'SUPPORT' &&
      ticket.assignedToId !== senderId &&
      ticket.userId !== senderId
    ) {
      throw new ForbiddenException('Ticket is not assigned to you');
    }

    if (
      senderRole !== 'CUSTOMER' &&
      senderRole !== 'SUPPORT' &&
      senderRole !== 'ADMIN'
    ) {
      throw new ForbiddenException('Invalid sender role');
    }

    const createdMessage = await this.prisma.ticketMessage.create({
      data: { ticketId, senderId, body: dto.body },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    this.eventEmitter.emit(SUPPORT_TICKET_MESSAGE_ADDED_EVENT, {
      ticketId: ticket.id,
      customerId: ticket.userId,
      assignedToId: ticket.assignedToId,
      ticketSubject: ticket.subject,
      senderId: createdMessage.sender.id,
      senderName: createdMessage.sender.name,
      messageBody: createdMessage.body,
    });

    return createdMessage;
  }

  async updateStatus(
    ticketId: string,
    dto: UpdateTicketStatusDto,
    changedById?: string,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        userId: true,
        assignedToId: true,
        subject: true,
        status: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const nextStatus = dto.status as TicketStatus;
    if (
      isReturnTicketSubject(ticket.subject) &&
      (nextStatus === 'RESOLVED' || nextStatus === 'CLOSED')
    ) {
      throw new BadRequestException(
        'Return tickets must use admin approval flow for RESOLVED/CLOSED states',
      );
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: nextStatus },
    });

    if (ticket.status !== updatedTicket.status) {
      this.eventEmitter.emit(SUPPORT_TICKET_STATUS_CHANGED_EVENT, {
        ticketId: ticket.id,
        customerId: ticket.userId,
        assignedToId: ticket.assignedToId,
        changedById,
        ticketSubject: ticket.subject,
        previousStatus: ticket.status,
        currentStatus: updatedTicket.status,
      });
    }

    return updatedTicket;
  }

  async assignAgent(ticketId: string, dto: AssignTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const agent = await this.prisma.user.findUnique({
      where: { id: dto.agentId },
    });
    if (!agent || (agent.role !== 'SUPPORT' && agent.role !== 'ADMIN')) {
      throw new NotFoundException('Support agent not found');
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToId: dto.agentId, status: 'IN_PROGRESS' },
    });
  }

  async listPendingReturnApprovalTickets() {
    const resolvedTickets = await this.prisma.supportTicket.findMany({
      where: {
        status: 'RESOLVED',
        OR: RETURN_SUBJECT_KEYWORDS.map((keyword) => ({
          subject: {
            contains: keyword,
            mode: 'insensitive',
          },
        })),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        agent: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    });

    return {
      data: resolvedTickets,
      total: resolvedTickets.length,
    };
  }

  async listReturnApprovalHistory(limit = 30) {
    const take = Number.isFinite(limit)
      ? Math.max(1, Math.min(100, limit))
      : 30;

    const events = await this.prisma.ticketMessage.findMany({
      where: {
        OR: [
          {
            body: {
              contains: RETURN_APPROVAL_REQUEST_MARKER,
              mode: 'insensitive',
            },
          },
          {
            body: {
              contains: 'Admin approved return completion.',
              mode: 'insensitive',
            },
          },
          {
            body: {
              contains:
                'Admin rejected return completion request and sent it back to support.',
              mode: 'insensitive',
            },
          },
        ],
        ticket: {
          OR: RETURN_SUBJECT_KEYWORDS.map((keyword) => ({
            subject: {
              contains: keyword,
              mode: 'insensitive',
            },
          })),
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        ticket: {
          select: {
            id: true,
            subject: true,
            status: true,
            updatedAt: true,
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return {
      data: events.map((event) => ({
        id: event.id,
        createdAt: event.createdAt,
        eventType: getApprovalEventType(event.body),
        note: extractOptionalNote(event.body),
        actor: {
          id: event.sender.id,
          name: event.sender.name,
          role: event.sender.role,
        },
        ticket: {
          id: event.ticket.id,
          subject: event.ticket.subject,
          status: event.ticket.status,
          updatedAt: event.ticket.updatedAt,
          customer: event.ticket.customer,
        },
      })),
      total: events.length,
    };
  }

  async requestReturnCompletionApproval(
    ticketId: string,
    requesterId: string,
    dto: RequestReturnApprovalDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (!isReturnTicketSubject(ticket.subject)) {
      throw new BadRequestException(
        'Admin approval can only be requested for return-related tickets',
      );
    }

    if (ticket.status === 'CLOSED') {
      throw new BadRequestException(
        'Cannot request approval for a closed ticket',
      );
    }

    if (ticket.status === 'RESOLVED') {
      throw new BadRequestException('Approval has already been requested');
    }

    const message = [
      RETURN_APPROVAL_REQUEST_MARKER,
      dto.note ? `Note: ${dto.note}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n\n');

    const updatedTicket = await this.prisma.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: {
          ticketId,
          senderId: requesterId,
          body: message,
        },
      });

      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'RESOLVED' },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          agent: { select: { id: true, name: true } },
          order: { select: { id: true, status: true, totalAmount: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              sender: { select: { id: true, name: true, role: true } },
            },
          },
        },
      });

      return updated;
    });

    await this.notifyAdmins(
      `Return approval requested • Ticket #${ticket.id.slice(0, 8)}`,
      [
        `Support requested return completion approval for ticket #${ticket.id.slice(0, 8)}.`,
        `Subject: ${ticket.subject}.`,
        ticket.orderId ? `Order #${ticket.orderId.slice(0, 8)}.` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' '),
    );

    const returnReference = [
      `Ticket #${ticket.id.slice(0, 8)}.`,
      ticket.orderId ? `Order #${ticket.orderId.slice(0, 8)}.` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');

    await this.createTicketUpdateNotificationForUsers(
      [ticket.customer.id],
      `Return request under final review • Ticket #${ticket.id.slice(0, 8)}`,
      `Our support team has escalated your return request for final admin approval. ${returnReference}`,
    );

    return updatedTicket;
  }

  async reviewReturnCompletionApproval(
    ticketId: string,
    reviewerId: string,
    dto: ReviewReturnApprovalDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        agent: { select: { id: true, name: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (!isReturnTicketSubject(ticket.subject)) {
      throw new BadRequestException(
        'Only return-related tickets can be reviewed in this workflow',
      );
    }

    if (ticket.status !== 'RESOLVED') {
      throw new BadRequestException('Ticket is not awaiting admin approval');
    }

    const approved = dto.decision === 'APPROVE';
    const nextStatus: TicketStatus = approved ? 'CLOSED' : 'IN_PROGRESS';
    const decisionText = approved
      ? 'Admin approved return completion.'
      : 'Admin rejected return completion request and sent it back to support.';
    const message = [decisionText, dto.note ? `Note: ${dto.note}` : null]
      .filter((value): value is string => Boolean(value))
      .join('\n\n');

    const updatedTicket = await this.prisma.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: {
          ticketId,
          senderId: reviewerId,
          body: message,
        },
      });

      return tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: nextStatus },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          agent: { select: { id: true, name: true } },
          order: { select: { id: true, status: true, totalAmount: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              sender: { select: { id: true, name: true, role: true } },
            },
          },
        },
      });
    });

    const decisionNote = dto.note?.trim() ? ` Note: ${dto.note.trim()}.` : '';
    const returnReference = [
      `Ticket #${ticket.id.slice(0, 8)}.`,
      ticket.orderId ? `Order #${ticket.orderId.slice(0, 8)}.` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');
    const customerMessage = approved
      ? `Your return request has been approved and completed. ${returnReference}${decisionNote}`
      : `Your return request is still being reviewed by support. ${returnReference}${decisionNote}`;

    await this.createTicketUpdateNotificationForUsers(
      [ticket.customer.id, ticket.assignedToId ?? ''],
      approved
        ? `Return approved • Ticket #${ticket.id.slice(0, 8)}`
        : `Return needs additional review • Ticket #${ticket.id.slice(0, 8)}`,
      customerMessage,
    );

    return updatedTicket;
  }
}
