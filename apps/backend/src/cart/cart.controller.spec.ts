import { CartController } from './cart.controller';
import type { CartService } from './cart.service';

describe('CartController', () => {
  function buildController() {
    const cartService = {
      getCart: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    } as unknown as CartService;

    const controller = new CartController(cartService);
    return { controller, cartService };
  }

  it('delegates getCart', async () => {
    const { controller, cartService } = buildController();
    (cartService.getCart as jest.Mock).mockResolvedValueOnce({
      id: 'cart-1',
      items: [],
    });

    await expect(controller.getCart('user-1')).resolves.toEqual({
      id: 'cart-1',
      items: [],
    });

    expect(cartService.getCart).toHaveBeenCalledWith('user-1');
  });

  it('delegates addItem and updateItem', async () => {
    const { controller, cartService } = buildController();
    const addDto = { variantId: 'variant-1', quantity: 2 };
    const updateDto = { quantity: 4 };

    (cartService.addItem as jest.Mock).mockResolvedValueOnce({
      id: 'cart-item-1',
      quantity: 2,
    });
    (cartService.updateItem as jest.Mock).mockResolvedValueOnce({
      id: 'cart-item-1',
      quantity: 4,
    });

    await expect(controller.addItem('user-1', addDto as any)).resolves.toEqual({
      id: 'cart-item-1',
      quantity: 2,
    });

    await expect(
      controller.updateItem('user-1', 'cart-item-1', updateDto as any),
    ).resolves.toEqual({
      id: 'cart-item-1',
      quantity: 4,
    });

    expect(cartService.addItem).toHaveBeenCalledWith('user-1', addDto);
    expect(cartService.updateItem).toHaveBeenCalledWith(
      'user-1',
      'cart-item-1',
      updateDto,
    );
  });

  it('delegates removeItem and clearCart', async () => {
    const { controller, cartService } = buildController();

    (cartService.removeItem as jest.Mock).mockResolvedValueOnce({
      removed: true,
    });
    (cartService.clearCart as jest.Mock).mockResolvedValueOnce({
      cleared: true,
    });

    await expect(
      controller.removeItem('user-1', 'cart-item-2'),
    ).resolves.toEqual({ removed: true });
    await expect(controller.clearCart('user-1')).resolves.toEqual({
      cleared: true,
    });

    expect(cartService.removeItem).toHaveBeenCalledWith(
      'user-1',
      'cart-item-2',
    );
    expect(cartService.clearCart).toHaveBeenCalledWith('user-1');
  });
});
