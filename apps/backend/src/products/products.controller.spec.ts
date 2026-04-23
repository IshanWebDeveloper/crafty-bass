import { ProductsController } from './products.controller';
import type { ProductsService } from './products.service';

describe('ProductsController', () => {
  function buildController() {
    const productsService = {
      findAll: jest.fn(),
      searchSuggestions: jest.fn(),
      compare: jest.fn(),
      getBrands: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStock: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as ProductsService;

    const controller = new ProductsController(productsService);
    return { controller, productsService };
  }

  it('delegates findAll with query filters', async () => {
    const { controller, productsService } = buildController();
    const query = { search: 'headphones', page: 2, limit: 12 };

    (productsService.findAll as jest.Mock).mockResolvedValueOnce({
      data: [],
      meta: { total: 0 },
    });

    await expect(controller.findAll(query as any)).resolves.toEqual({
      data: [],
      meta: { total: 0 },
    });
    expect(productsService.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates search with q, limit and optional userId', async () => {
    const { controller, productsService } = buildController();
    const query = { q: 'airpod', limit: 6 };

    (productsService.searchSuggestions as jest.Mock).mockResolvedValueOnce([
      { id: 'p1', name: 'AirPods Pro' },
    ]);

    await expect(controller.search(query as any, 'user-1')).resolves.toEqual([
      { id: 'p1', name: 'AirPods Pro' },
    ]);

    expect(productsService.searchSuggestions).toHaveBeenCalledWith(
      'airpod',
      6,
      'user-1',
    );
  });

  it('delegates compare ids', async () => {
    const { controller, productsService } = buildController();
    const ids = ['p1', 'p2'];

    (productsService.compare as jest.Mock).mockResolvedValueOnce({
      compared: 2,
    });

    await expect(controller.compare({ ids } as any)).resolves.toEqual({
      compared: 2,
    });
    expect(productsService.compare).toHaveBeenCalledWith(ids);
  });

  it('gets brands through service helper', async () => {
    const { controller, productsService } = buildController();
    (productsService.getBrands as jest.Mock).mockResolvedValueOnce([
      'Apple',
      'Sony',
    ]);

    await expect(controller.getBrands()).resolves.toEqual(['Apple', 'Sony']);
    expect(productsService.getBrands).toHaveBeenCalledTimes(1);
  });

  it('delegates create, update, stock update and remove actions', async () => {
    const { controller, productsService } = buildController();

    (productsService.create as jest.Mock).mockResolvedValueOnce({
      id: 'new-p',
    });
    (productsService.update as jest.Mock).mockResolvedValueOnce({ id: 'p1' });
    (productsService.updateStock as jest.Mock).mockResolvedValueOnce({
      id: 'v1',
      stock: 42,
    });
    (productsService.softDelete as jest.Mock).mockResolvedValueOnce({
      id: 'p1',
      isActive: false,
    });

    await expect(
      controller.create({ name: 'Phone X' } as any),
    ).resolves.toEqual({ id: 'new-p' });
    await expect(
      controller.update('p1', { name: 'Phone X2' } as any),
    ).resolves.toEqual({ id: 'p1' });
    await expect(
      controller.updateStock('v1', { stock: 42 } as any),
    ).resolves.toEqual({ id: 'v1', stock: 42 });
    await expect(controller.remove('p1')).resolves.toEqual({
      id: 'p1',
      isActive: false,
    });

    expect(productsService.create).toHaveBeenCalledWith({ name: 'Phone X' });
    expect(productsService.update).toHaveBeenCalledWith('p1', {
      name: 'Phone X2',
    });
    expect(productsService.updateStock).toHaveBeenCalledWith('v1', {
      stock: 42,
    });
    expect(productsService.softDelete).toHaveBeenCalledWith('p1');
  });

  it('delegates findById and findBySlug', async () => {
    const { controller, productsService } = buildController();

    (productsService.findById as jest.Mock).mockResolvedValueOnce({ id: 'p1' });
    (productsService.findBySlug as jest.Mock).mockResolvedValueOnce({
      id: 'p2',
      slug: 'wired-headphones',
    });

    await expect(controller.findById('p1')).resolves.toEqual({ id: 'p1' });
    await expect(controller.findBySlug('wired-headphones')).resolves.toEqual({
      id: 'p2',
      slug: 'wired-headphones',
    });

    expect(productsService.findById).toHaveBeenCalledWith('p1');
    expect(productsService.findBySlug).toHaveBeenCalledWith('wired-headphones');
  });
});
