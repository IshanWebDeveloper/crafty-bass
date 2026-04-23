import { PaymentsController } from './payments.controller';
import type { PaymentsService } from './payments.service';

jest.mock('./payments.service.js', () => ({
  PaymentsService: class PaymentsService {},
}));

describe('PaymentsController', () => {
  function buildController() {
    const paymentsService = {
      initiateCheckout: jest.fn(),
      handleWebhook: jest.fn(),
      getPaymentStatus: jest.fn(),
      resolveCheckoutSession: jest.fn(),
      requestRefund: jest.fn(),
      refund: jest.fn(),
    } as unknown as PaymentsService;

    const controller = new PaymentsController(paymentsService);
    return { controller, paymentsService };
  }

  it('initiates checkout for a signed-in user', async () => {
    const { controller, paymentsService } = buildController();
    const dto = { orderId: 'd356af4b-cfc2-44fd-a713-c37dbd6f5d3e' };

    (paymentsService.initiateCheckout as jest.Mock).mockResolvedValueOnce({
      checkoutUrl: 'https://example.test/checkout',
    });

    await expect(
      controller.initiateCheckout('user-1', dto as any),
    ).resolves.toEqual({ checkoutUrl: 'https://example.test/checkout' });

    expect(paymentsService.initiateCheckout).toHaveBeenCalledWith(
      'user-1',
      dto,
    );
  });

  it('returns a graceful response if webhook raw body is missing', async () => {
    const { controller, paymentsService } = buildController();

    await expect(
      controller.handleWebhook({ rawBody: undefined }, 'sig_test'),
    ).resolves.toEqual({ received: false, error: 'No raw body' });

    expect(paymentsService.handleWebhook).not.toHaveBeenCalled();
  });

  it('delegates webhook handling when raw body is present', async () => {
    const { controller, paymentsService } = buildController();
    const rawBody = Buffer.from('{"type":"checkout.session.completed"}');

    (paymentsService.handleWebhook as jest.Mock).mockResolvedValueOnce({
      received: true,
    });

    await expect(
      controller.handleWebhook({ rawBody }, 'sig_valid'),
    ).resolves.toEqual({ received: true });

    expect(paymentsService.handleWebhook).toHaveBeenCalledWith(
      rawBody,
      'sig_valid',
    );
  });

  it('uses role-aware filtering for payment status and checkout session lookup', async () => {
    const { controller, paymentsService } = buildController();

    (paymentsService.getPaymentStatus as jest.Mock).mockResolvedValueOnce({
      status: 'PENDING',
    });
    (paymentsService.resolveCheckoutSession as jest.Mock).mockResolvedValueOnce(
      {
        orderId: 'order-1',
      },
    );

    await expect(
      controller.getPaymentStatus('user-1', 'CUSTOMER', 'order-1'),
    ).resolves.toEqual({ status: 'PENDING' });
    await expect(
      controller.resolveCheckoutSession('user-1', 'ADMIN', 'sess_123'),
    ).resolves.toEqual({ orderId: 'order-1' });

    expect(paymentsService.getPaymentStatus).toHaveBeenCalledWith(
      'order-1',
      'user-1',
    );
    expect(paymentsService.resolveCheckoutSession).toHaveBeenCalledWith(
      'sess_123',
      undefined,
    );
  });

  it('uses role-aware filtering when creating refund requests', async () => {
    const { controller, paymentsService } = buildController();
    const dto = { reason: 'Item was defective' };

    (paymentsService.requestRefund as jest.Mock).mockResolvedValueOnce({
      status: 'REQUESTED',
    });

    await expect(
      controller.requestRefund('user-2', 'CUSTOMER', 'order-2', dto as any),
    ).resolves.toEqual({ status: 'REQUESTED' });

    expect(paymentsService.requestRefund).toHaveBeenCalledWith(
      'order-2',
      'user-2',
      dto,
      'user-2',
    );
  });

  it('delegates admin refund action', async () => {
    const { controller, paymentsService } = buildController();
    const dto = { reason: 'Approved by admin' };

    (paymentsService.refund as jest.Mock).mockResolvedValueOnce({
      status: 'REFUNDED',
    });

    await expect(
      controller.refund('admin-1', 'order-7', dto as any),
    ).resolves.toEqual({ status: 'REFUNDED' });

    expect(paymentsService.refund).toHaveBeenCalledWith(
      'order-7',
      dto,
      'admin-1',
    );
  });
});
