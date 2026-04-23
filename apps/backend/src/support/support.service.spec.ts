import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';

import { SupportService } from './support.service';
import type { PrismaService } from '../common/prisma/prisma.service';

describe('SupportService', () => {
  function buildService() {
    const prisma = {
      supportTicket: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      ticketMessage: {
        create: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      notification: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const eventEmitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    const service = new SupportService(prisma, eventEmitter);

    return { service, prisma, eventEmitter };
  }

  it('creates a ticket with the initial message payload', async () => {
    const { service, prisma } = buildService();

    (prisma.supportTicket.create as jest.Mock).mockResolvedValueOnce({
      id: 'ticket-1',
    });

    await service.createTicket('user-1', {
      subject: 'Order arrived damaged',
      category: 'COMPLAINT',
      priority: 'HIGH',
      body: 'The screen has a visible crack.',
    });

    expect(prisma.supportTicket.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        subject: 'Order arrived damaged',
        category: 'COMPLAINT',
        priority: 'HIGH',
        orderId: null,
        messages: {
          create: {
            senderId: 'user-1',
            body: 'The screen has a visible crack.',
          },
        },
      },
      include: {
        messages: true,
      },
    });
  });

  it('blocks resolving a return-related ticket without the approval workflow', async () => {
    const { service, prisma } = buildService();

    (prisma.supportTicket.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'ticket-1',
      userId: 'customer-1',
      assignedToId: 'support-1',
      subject: 'Return request for damaged item',
      status: 'IN_PROGRESS',
    });

    await expect(
      service.updateStatus('ticket-1', { status: 'RESOLVED' }, 'support-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'Return tickets must use admin approval flow for RESOLVED/CLOSED states',
      ),
    );

    expect(prisma.supportTicket.update).not.toHaveBeenCalled();
  });

  it('requests return approval and notifies admins and the customer', async () => {
    const { service, prisma } = buildService();

    (prisma.supportTicket.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'ticket-12345678',
      userId: 'customer-1',
      assignedToId: 'support-1',
      subject: 'Return request for damaged item',
      status: 'IN_PROGRESS',
      orderId: 'order-12345678',
      customer: {
        id: 'customer-1',
        name: 'Customer One',
        email: 'customer@example.com',
      },
    });

    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'admin-1' },
      { id: 'admin-2' },
    ]);

    const transactionClient = {
      ticketMessage: {
        create: jest.fn().mockResolvedValueOnce({ id: 'message-1' }),
      },
      supportTicket: {
        update: jest.fn().mockResolvedValueOnce({
          id: 'ticket-12345678',
          status: 'RESOLVED',
          customer: {
            id: 'customer-1',
            name: 'Customer One',
            email: 'customer@example.com',
          },
          agent: {
            id: 'support-1',
            name: 'Support Agent',
          },
          order: {
            id: 'order-12345678',
            status: 'DELIVERED',
            totalAmount: 100,
          },
          messages: [],
        }),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    (prisma.notification.createMany as jest.Mock).mockResolvedValueOnce({
      count: 2,
    });

    const result = await service.requestReturnCompletionApproval(
      'ticket-12345678',
      'support-1',
      { note: 'Customer requested inspection before approval.' },
    );

    expect(transactionClient.ticketMessage.create).toHaveBeenCalledWith({
      data: {
        ticketId: 'ticket-12345678',
        senderId: 'support-1',
        body: 'Support has requested admin approval to complete this return process.\n\nNote: Customer requested inspection before approval.',
      },
    });

    expect(transactionClient.supportTicket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-12345678' },
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

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    expect(prisma.notification.createMany).toHaveBeenCalledTimes(2);
    expect(result).toEqual(expect.objectContaining({ status: 'RESOLVED' }));
  });
});
