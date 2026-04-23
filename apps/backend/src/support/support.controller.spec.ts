import { SupportController } from './support.controller';
import type { SupportService } from './support.service';

describe('SupportController', () => {
  function buildController() {
    const supportService = {
      createTicket: jest.fn(),
      listTickets: jest.fn(),
      listPendingReturnApprovalTickets: jest.fn(),
      listReturnApprovalHistory: jest.fn(),
      getTicket: jest.fn(),
      addMessage: jest.fn(),
      requestReturnCompletionApproval: jest.fn(),
      reviewReturnCompletionApproval: jest.fn(),
      updateStatus: jest.fn(),
      assignAgent: jest.fn(),
    } as unknown as SupportService;

    const controller = new SupportController(supportService);
    return { controller, supportService };
  }

  it('delegates ticket creation and listing', async () => {
    const { controller, supportService } = buildController();
    const createDto = { subject: 'Need help', message: 'Order delayed' };
    const listQuery = { page: 2, limit: 10, status: 'OPEN' };

    (supportService.createTicket as jest.Mock).mockResolvedValueOnce({
      id: 'ticket-1',
    });
    (supportService.listTickets as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'ticket-1' }],
      meta: { total: 1 },
    });

    await expect(
      controller.create('user-1', createDto as any),
    ).resolves.toEqual({
      id: 'ticket-1',
    });
    await expect(
      controller.list('user-1', 'CUSTOMER', listQuery as any),
    ).resolves.toEqual({
      data: [{ id: 'ticket-1' }],
      meta: { total: 1 },
    });

    expect(supportService.createTicket).toHaveBeenCalledWith(
      'user-1',
      createDto,
    );
    expect(supportService.listTickets).toHaveBeenCalledWith(
      'user-1',
      'CUSTOMER',
      listQuery,
    );
  });

  it('delegates ticket details and message operations', async () => {
    const { controller, supportService } = buildController();

    (supportService.getTicket as jest.Mock).mockResolvedValueOnce({
      id: 'ticket-2',
    });
    (supportService.addMessage as jest.Mock).mockResolvedValueOnce({
      id: 'msg-1',
      content: 'We are checking this now',
    });

    await expect(
      controller.get('user-2', 'SUPPORT', 'ticket-2'),
    ).resolves.toEqual({ id: 'ticket-2' });
    await expect(
      controller.addMessage('agent-1', 'SUPPORT', 'ticket-2', {
        message: 'We are checking this now',
      } as any),
    ).resolves.toEqual({
      id: 'msg-1',
      content: 'We are checking this now',
    });

    expect(supportService.getTicket).toHaveBeenCalledWith(
      'ticket-2',
      'user-2',
      'SUPPORT',
    );
    expect(supportService.addMessage).toHaveBeenCalledWith(
      'ticket-2',
      'agent-1',
      'SUPPORT',
      { message: 'We are checking this now' },
    );
  });

  it('uses default and parsed limit values for return approval history', async () => {
    const { controller, supportService } = buildController();

    (supportService.listReturnApprovalHistory as jest.Mock)
      .mockResolvedValueOnce([{ id: 'evt-default' }])
      .mockResolvedValueOnce([{ id: 'evt-custom' }]);

    await expect(controller.listReturnApprovalHistory()).resolves.toEqual([
      { id: 'evt-default' },
    ]);
    await expect(controller.listReturnApprovalHistory('12')).resolves.toEqual([
      { id: 'evt-custom' },
    ]);

    expect(supportService.listReturnApprovalHistory).toHaveBeenNthCalledWith(
      1,
      30,
    );
    expect(supportService.listReturnApprovalHistory).toHaveBeenNthCalledWith(
      2,
      12,
    );
  });

  it('delegates return approval workflow actions', async () => {
    const { controller, supportService } = buildController();

    (
      supportService.requestReturnCompletionApproval as jest.Mock
    ).mockResolvedValueOnce({
      status: 'PENDING_APPROVAL',
    });
    (
      supportService.reviewReturnCompletionApproval as jest.Mock
    ).mockResolvedValueOnce({
      status: 'APPROVED',
    });

    await expect(
      controller.requestReturnApproval('ticket-3', 'agent-2', {
        note: 'Customer returned item',
      } as any),
    ).resolves.toEqual({
      status: 'PENDING_APPROVAL',
    });
    await expect(
      controller.reviewReturnApproval('ticket-3', 'admin-2', {
        decision: 'APPROVE',
      } as any),
    ).resolves.toEqual({
      status: 'APPROVED',
    });

    expect(supportService.requestReturnCompletionApproval).toHaveBeenCalledWith(
      'ticket-3',
      'agent-2',
      { note: 'Customer returned item' },
    );
    expect(supportService.reviewReturnCompletionApproval).toHaveBeenCalledWith(
      'ticket-3',
      'admin-2',
      { decision: 'APPROVE' },
    );
  });

  it('delegates status update and assignment actions', async () => {
    const { controller, supportService } = buildController();

    (supportService.updateStatus as jest.Mock).mockResolvedValueOnce({
      id: 'ticket-4',
      status: 'RESOLVED',
    });
    (supportService.assignAgent as jest.Mock).mockResolvedValueOnce({
      id: 'ticket-4',
      agentId: 'agent-4',
    });

    await expect(
      controller.updateStatus('ticket-4', 'agent-4', {
        status: 'RESOLVED',
      } as any),
    ).resolves.toEqual({
      id: 'ticket-4',
      status: 'RESOLVED',
    });
    await expect(
      controller.assign('ticket-4', { agentId: 'agent-4' } as any),
    ).resolves.toEqual({
      id: 'ticket-4',
      agentId: 'agent-4',
    });

    expect(supportService.updateStatus).toHaveBeenCalledWith(
      'ticket-4',
      { status: 'RESOLVED' },
      'agent-4',
    );
    expect(supportService.assignAgent).toHaveBeenCalledWith('ticket-4', {
      agentId: 'agent-4',
    });
  });

  it('delegates pending approvals listing', async () => {
    const { controller, supportService } = buildController();
    (
      supportService.listPendingReturnApprovalTickets as jest.Mock
    ).mockResolvedValueOnce([{ id: 'ticket-5' }]);

    await expect(controller.listPendingReturnApprovals()).resolves.toEqual([
      { id: 'ticket-5' },
    ]);
    expect(
      supportService.listPendingReturnApprovalTickets,
    ).toHaveBeenCalledTimes(1);
  });
});
